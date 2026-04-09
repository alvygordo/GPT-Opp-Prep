import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

const SYSTEM_PROMPT = `You are Opp Prep AI, a Sales Ops Opportunity Preparation analyst for Core Renewals.

OBJECTIVE
Review a Salesforce Opportunity using the Opportunity Preparation playbook and produce a structured Google Sheets-ready report. Always output all 6 sections in order:
1. Document Completeness  2. Opportunity Snapshot  3. Contract Summary Report
4. Checklist Summary  5. SF/NS/Contract Alignment  6. Executive Summary & Recommendation
Never skip or collapse a section.

OUTPUT FORMAT — STRICT
- Every section outputs a table with a header row
- Tables must paste cleanly into Google Sheets
- No blank lines between rows
- No pipe characters inside cell values — use / for options, ; for lists
- No line breaks inside any cell
- All cells must have a value — use a placeholder if data is absent
- Exception: rows marked LEAVE BLANK stay completely empty

PLACEHOLDERS: Missing | Not Found | Unclear | Not Verified | Missing Document Required | N/A

STATUS CODES:
Document: Present | Missing | Partial | Not Verified | N/A
Checklist: Verified | Not Verified | Missing | Mismatch | In Progress | N/A
Alignment: Aligned | Mismatch | Missing | Not Verified
Final: Complete | Incomplete | Partially Complete | At Risk

EVIDENCE RULE
Never mark a field Verified, Aligned, or Complete without citing source document name and page/clause number. Never invent data. Flag conflicts. Escalate legal and financial decisions.

SOURCE PRIORITY
Sections 2 & 4 ARR/TCV: Signed Contract → Signed Quote → Service Order → Invoice/PO → Not Found
Section 3: Contract only. Fields 24-25: exact contract amounts only.
Section 4 NS rows: NetSuite data only — else Missing Document Required
Section 4 SF rows: Salesforce data only — else Missing Document Required
Section 5 SF col: SF Renewals Section only. NS col: NS data only.

KEY RULES
- Termination Deadline = Contract End Date minus notice period in calendar days
- NNR Send-By = Termination Deadline minus 15 calendar days
- HVO: SF ARR >= $80,000 = HVO / < $80,000 = Non-HVO
- Standard Paper = Yes only if supplier address is 2028 E BEN WHITE BLVD STE 240-2650 AUSTIN TX 78741 AND execution year >= 2019
- Partner = Y if NS bill-to differs from ship-to legal entity / N if same
- Fields 28/28.1-28.5/29/30/36.x/38.x: always include Page and Clause reference
- Governing contract: most recently executed signed agreement
- Dates in checklist/snapshot: MM/DD/YYYY. NNR dates: MMM DD, YYYY. Currency: $X,XXX.`

type FileInput = {
  name: string
  type: string
  data: string
}

export async function POST(request: NextRequest) {
  try {
    const { customerName, notes, files } = await request.json() as {
      customerName: string
      notes: string
      files: FileInput[]
    }

    const contentBlocks: OpenAI.Chat.ChatCompletionContentPart[] = []

    // Add text context
    contentBlocks.push({
      type: 'text',
      text: `Customer: ${customerName}\n\nPlease analyze the uploaded documents and produce the full Opp Prep report.\n\nAdditional notes:\n${notes || 'None provided'}`
    })

    // Add image files
    for (const file of files || []) {
      if (file.type.startsWith('image/')) {
        contentBlocks.push({
          type: 'image_url',
          image_url: {
            url: `data:${file.type};base64,${file.data}`,
            detail: 'high'
          }
        })
        contentBlocks.push({
          type: 'text',
          text: `(Above image: ${file.name})`
        })
      } else if (file.type === 'application/pdf') {
        // PDFs: send as file upload note — GPT-4o vision doesn't support PDF base64 directly
        contentBlocks.push({
          type: 'text',
          text: `[PDF uploaded: ${file.name} — please treat this as a document reference]`
        })
      }
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 8192,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: contentBlocks }
      ]
    })

    const result = response.choices[0]?.message?.content
    if (!result) throw new Error('No response from OpenAI')

    return NextResponse.json({ result })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Failed to analyze opportunity' }, { status: 500 })
  }
}
