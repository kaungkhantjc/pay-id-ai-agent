### 🚀 Pay ID AI Agent

**Pay ID AI Agent** is a lightweight AI-powered API that accepts an e-Receipt photo from Myanmar mobile wallet apps (
e.g., KBZ Pay, WavePay, AYA Pay) and intelligently extracts the Transaction ID, along with a short explanation of how it
was found.

It uses **Google Gemini 2.5 Flash Lite** vision model for ultra-fast, cost-effective receipt understanding.

#### Example Use Case

Send an e-Receipt image via a simple HTTP request and get a structured JSON response with:

- Extracted transaction_id
- reason for extraction (e.g., found label or pattern)
- Token usage metadata

#### API Endpoint

```text
POST /generate
```

Request body

```json5
{
  // Required
  "agent_token": "HuE60doYwlWdB2X7K5F9E529Lr20qu6PsRsk4Nc",
  // Required
  "gemini_key": "your-gemini-api-key",
  // Optional
  "image_url": "https://example.com/receipt.jpg",
  // Optional
  "image": "<image file>"
}
```

#### Example Response

```json
{
  "status": true,
  "data": {
    "content": {
      "reason": "Found 'Transaction ID' label",
      "transaction_id": "123456789"
    },
    "rawContent": "{\n  \"reason\": \"Found 'Transaction ID' label\",\n  \"transaction_id\": \"123456789\"\n}",
    "usageMetadata": {
      "promptTokenCount": 435,
      "candidatesTokenCount": 45,
      "totalTokenCount": 480,
      "promptTokensDetails": [
        {
          "modality": "TEXT",
          "tokenCount": 177
        },
        {
          "modality": "IMAGE",
          "tokenCount": 258
        }
      ]
    },
    "modelVersion": "gemini-2.5-flash-lite-preview-06-17",
    "responseId": "xxxxxxxxxx-xxxxxxxxxxxx"
  },
  "message": null
}
```

> [!NOTE]
> - agent_token is the API access key of this AI agent.
> - gemini_key is your own [Google AI Studio API key](https://aistudio.google.com/app/apikey).
> - You must provide either `image_url` or `image`, but not both.

#### Development

```txt
cp .dev.vars.example .dev.vars
npm install
npm run dev
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

#### Contributing

I'd love to accept your patches and contributions to this project. All submissions, including submissions by project
members, require review. I use GitHub pull requests for this purpose. Consult GitHub Help for more information on using
pull requests.

Please perform a quick search to check if there are already existing issues or pull requests related to your
contribution.

#### License

Pay ID AI agent is released under the Apache 2.0 license.

```
Copyright 2025 Pay ID AI agent Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```