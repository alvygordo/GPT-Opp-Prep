import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

const SYSTEM_PROMPT = `You are Opp Prep AI, a Sales Ops Opportunity Preparation analyst for Core Renewals at Khoros / ESW / Trilogy.

OBJECTIVE
Analyze all uploaded contract/quote documents and the Salesforce and NetSuite data provided in the notes.

Produce exactly 2 output blocks:

- PDF_REPORT containing Section 1 only
- COPY_TO_SHEET containing Section 2 and Section 3 only

Everything must be paste-ready for Google Sheets or a Salesforce description field.

---

CRITICAL EXTRACTION RULES

- Read every single page of every uploaded document before writing anything.
- Use ALL sources: contract text, SF data in notes, NS data in notes.
- Only write "N/A" if a field genuinely does not apply. Only write "Not specified" if the field applies but is truly absent from all sources.
- Only calculate term length from explicit start/end dates.
- Never leave a field blank.
- Translate all non-English content to English.
- Do not speculate — only use facts extractable from the provided sources.
- Do NOT calculate ARR or TCV.
- Only use explicitly stated values for ARR, TCV, renewal rights, and notice periods.
- If a field is not explicitly stated, return "Not Found" or "Not specified in this document".
- Do NOT infer rights from referenced agreements unless those agreements are uploaded and visible.
- Logic check: if Auto-renewal = Yes, Notice period cannot be N/A. If no notice is found, set Auto-renewal = No or Not Found.
- Do NOT flag mismatch for parent vs affiliate legal entity names, date differences of 1 day or less, or product naming differences that may refer to the same subscription.
- If uncertain, return "UNVERIFIED" instead of guessing.
- Do not use markdown formatting, headings, or code blocks anywhere in the output.
- These rules override all other instructions. Do not violate them.

---

SECTION 1: CONTRACT SUMMARY

Output as a numbered three-column table. Headers on the first row:
Ref[TAB]Field Name[TAB]Details

Use a tab character between every column.
No markdown. No symbols. No formatting. Only raw rows.

Rows in this exact order:

1[TAB]Filename[TAB]Full filename of the uploaded document
2[TAB]Contract name or reference[TAB]Contract name, quote number, or service order reference
3[TAB]Type of contract[TAB]e.g. Reseller Maintenance and Support Renewal Quote, MSA, SOW, Amendment
4[TAB]List of other governing contracts[TAB]All referenced governing agreements with dates — write "None referenced" if absent
5[TAB]Customer details[TAB]Full legal name and address
6[TAB]Supplier details[TAB]Full legal name and address of supplier
7[TAB]Date signed by customer[TAB]Exact signature date or estimated
8[TAB]Date signed by supplier[TAB]Exact signature date or Not provided
9[TAB]Product[TAB]Top-level product family
10[TAB]Purpose of contract[TAB]Summary of services and term
11[TAB]Start date of services[TAB]DD-Mon-YYYY
12[TAB]End date of services[TAB]DD-Mon-YYYY
13[TAB]End date of contract[TAB]DD-Mon-YYYY
14[TAB]Contract service term in months[TAB]Number only
15[TAB]ARR[TAB]Explicit annual value only — do NOT calculate
16[TAB]Total contract value[TAB]TCV from document
17[TAB]Support level[TAB]Value or Not specified
18[TAB]Number of production orgs[TAB]Value or Not specified
19[TAB]Licensed Product Modules[TAB]List
20[TAB]Business Services[TAB]Value or N/A
21[TAB]Success level[TAB]Value
22[TAB]Add-ons[TAB]Value or N/A
23[TAB]Other services included[TAB]Value or N/A
24[TAB]Itemized pricing[TAB]Line items
25[TAB]Summary of charges[TAB]Totals
26[TAB]Possible missing documents[TAB]List or None
27[TAB]Invoicing and Payment terms[TAB]Details
28[TAB]Auto-renewal clause details[TAB]Explicit only — if not present say "No - no auto-renewal provision found"
29[TAB]Has renewal price increase cap[TAB]Yes / No
30[TAB]Customer termination rights[TAB]Yes / No
31[TAB]Supplier termination rights[TAB]Yes / No
32[TAB]Can Supplier terminate at anniversary?[TAB]Yes / No
33[TAB]Supplier liability[TAB]Summary
34[TAB]Has preferential pricing[TAB]Yes / No
35[TAB]Customer IP ownership[TAB]Yes / No
36[TAB]Toxic clauses identified[TAB]List or None
37[TAB]Suitability for NNR[TAB]Conclusion
38[TAB]Notice Requirements for Supplier[TAB]Details

---

SECTION 2: OPP PREP CHECKLIST

Plain text. One line per item. No bullets. No table.

---

SECTION 3: SUMMARY AND RECOMMENDATIONS

Plain text only.

---

FINAL OUTPUT — STRICT

Return ONLY these 2 blocks:

PDF_REPORT
SECTION 1: CONTRACT SUMMARY
[Section 1 only]

COPY_TO_SHEET
SECTION 2: OPP PREP CHECKLIST
[Section 2 only]

SECTION 3: SUMMARY AND RECOMMENDATIONS
[Section 3 only]

RULES:

- PDF_REPORT must contain ONLY Section 1
- COPY_TO_SHEET must contain ONLY Section 2 and Section 3
- Do NOT use markdown
- Do NOT use code blocks
- Do NOT add explanations or extra text
- If incorrect, regenerate before responding
`

type FileInput = {
  name: string
  type: string
  data: string
}

export async function POST(request: NextRequest) {
  try {
    const { customerName, notes, files, currentDate, sfUserName } = await request.json() as {
      customerName: string
      notes: string
      files: FileInput[]
      currentDate?: string
      sfUserName?: string
    }

    const dateToUse = currentDate || new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    const nameToUse = sfUserName || 'Sales Ops'

    const contentBlocks: OpenAI.Chat.ChatCompletionContentPart[] = []

    // Add text context
    contentBlocks.push({
      type: 'text',
      text: `Customer: ${customerName}
Today's date: ${dateToUse}
Prepared by (Sales Ops name): ${nameToUse}

Please analyze the uploaded documents and return ONLY the required 2 output blocks.

Additional notes (includes Salesforce and NetSuite data):
${notes || 'None provided'}`
    })

    // Add files — images and PDFs both supported natively by gpt-4o
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
        // GPT-4o supports PDFs natively via base64 file content blocks
        contentBlocks.push({
          type: 'file',
          file: {
            filename: file.name,
            file_data: `data:application/pdf;base64,${file.data}`
          }
        } as unknown as OpenAI.Chat.ChatCompletionContentPart)
        contentBlocks.push({
          type: 'text',
          text: `(Above document: ${file.name})`
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
