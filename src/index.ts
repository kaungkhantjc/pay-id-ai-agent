import {Hono} from 'hono'
import {generate} from "./generate";

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.post('/generate', async (c) => {
    return await generate(c)
})

export default app
