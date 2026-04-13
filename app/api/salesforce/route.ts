import { NextRequest, NextResponse } from 'next/server'
// @ts-ignore
import jsforce from 'jsforce'

export async function POST(request: NextRequest) {
  try {
    const { opportunityName } = await request.json()

    const conn = new jsforce.Connection({
      loginUrl: 'https://login.salesforce.com'
    })

    await conn.login(
      process.env.SALESFORCE_USERNAME!,
      process.env.SALESFORCE_PASSWORD! + process.env.SALESFORCE_TOKEN!
    )

    // Search for opportunity by name
    const result = await conn.query(`
      SELECT
        Id, Name, StageName, CloseDate, Amount,
        AccountId, Account.Name,
        Owner.Name, OwnerId,
        Type, LeadSource, Description,
        CreatedDate, LastModifiedDate
      FROM Opportunity
      WHERE Name LIKE '%${opportunityName.replace(/'/g, "\\'")}%'
      ORDER BY LastModifiedDate DESC
      LIMIT 10
    `)

    return NextResponse.json({ opportunities: result.records })
  } catch (error) {
    console.error('Salesforce error:', error)
    return NextResponse.json(
      { error: 'Failed to connect to Salesforce' },
      { status: 500 }
    )
  }
}
