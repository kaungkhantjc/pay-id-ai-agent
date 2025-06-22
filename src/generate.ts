import {Context} from "hono";
import {env} from "cloudflare:workers";
import {z} from "zod";
import {Buffer} from 'node:buffer';

const generateSchema = z.object({
    agent_token: z.literal(env.AGENT_TOKEN, {errorMap: () => ({message: 'Agent token not valid. Please pass a valid agent token.'})}),
    gemini_key: z.string(),
    image_url: z.string().url('image_url must be URL.').optional(),
    image: z.instanceof(File)
        .refine(file => file.type.startsWith('image/'), 'Image file must be an image.')
        .refine(file => file.size <= 5 * 1024 * 1024, 'Image file size must be <= 5 MB.')
        .optional(),
}).superRefine((data, ctx) => {
    if (!data.image && !data.image_url) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Either "image" or "image_url" is required. Please provide one.',
            path: ['image', 'image_url'],
        });
    }
});

const encodeBase64 = (buffer: ArrayBuffer): string => {
    return Buffer.from(buffer).toString('base64');
};

const getImageArrayBuffer = async (url: string): Promise<ArrayBuffer | null> => {
    const MAX_SIZE = 5 * 1024 * 1024;

    try {
        const res = await fetch(url);
        if (!res.ok || !res.headers.get('Content-Type')?.startsWith('image/') || !res.body) return null;

        let bytesRead = 0;
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
            const {done, value} = await reader.read();
            if (done) break;

            bytesRead += value.length;
            if (bytesRead > MAX_SIZE) {
                await reader.cancel();
                return null;
            }
            chunks.push(value);
        }

        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        return result.buffer;
    } catch {
        return null;
    }
};

const generateInGemini = async (key: string, encodedImage: string) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${key}`

    const body = {
        contents: [{
            role: 'user',
            parts: [{text: env.GEMINI_PROMPT}, {inline_data: {mime_type: 'image/jpeg', data: encodedImage}}]
        }],
        generationConfig: {
            thinkingConfig: {
                thinkingBudget: 0
            },
            responseMimeType: 'application/json',
            responseSchema: {
                type: 'object',
                properties: {
                    transaction_id: {type: 'string'},
                    reason: {type: 'string'}
                },
                required: ['reason']
            }
        }
    }

    try {
        const headers = new Headers();
        headers.append('Content-Type', 'application/json');

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
        })

        if (response.ok) {
            return {status: true, data: await response.json()};
        } else if (response.status === 400) {
            return {
                status: false,
                message: (await response.json() as any).error.message
            };
        } else if (response.status === 404) {
            return {status: false, message: `Gemini model "${env.GEMINI_MODEL}" is not found.`};
        } else {
            return {status: false, message: `Unexpected response from Gemini API with status code: ${response.status}`};
        }
    } catch (e) {
        return {status: false, message: "Unexpected error occurred while generating response from Gemini API."};
    }
}

const parseGeneratedText = (text: string) => {
    const generatedTextSchema = z.object({
        reason: z.string(),
        transaction_id: z.string().nullable(),
    })

    try {
        const parsedJson = JSON.parse(text);
        return generatedTextSchema.parse(parsedJson);
    } catch (error) {
        return null
    }
}

export const generate = async (c: Context) => {
    const body = await c.req.parseBody();
    const result = generateSchema.safeParse(body);

    if (!result.success) return c.json(result.error.formErrors, 422)

    const {image, image_url} = result.data;
    let base64Image = "";

    if (image) {
        base64Image = encodeBase64(await image.arrayBuffer())
    } else if (image_url) {
        const imageArrayBuffer = await getImageArrayBuffer(image_url);
        if (!imageArrayBuffer) return c.json({
            formErrors: [],
            fieldErrors: {image_url: ["Failed to fetch image from image_url."]}
        }, 422)
        base64Image = encodeBase64(imageArrayBuffer)
    }

    const response = await generateInGemini(result.data.gemini_key, base64Image);

    if (response.status) {
        const geminiResponse: any = response.data
        const generatedText = geminiResponse.candidates[0].content.parts[0].text
        const generatedJson = parseGeneratedText(generatedText);

        return c.json({
            status: generatedJson !== null,
            data: {
                content: generatedJson,
                rawContent: generatedText,
                usageMetadata: geminiResponse.usageMetadata,
                modelVersion: geminiResponse.modelVersion,
                responseId: geminiResponse.responseId,
            },
            message: generatedJson !== null ? null : 'Got unexpected response from Gemini API.',
        });
    } else {
        return c.json({
            status: false,
            data: null,
            message: response.message
        })
    }

}