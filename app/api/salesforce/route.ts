import { NextRequest, NextResponse } from 'next/server'
// @ts-ignore
import jsforce from 'jsforce'

export async function POST(request: NextRequest) {
  try {
    const { opportunityName } = await request.json()

    const conn = new jsforce.Connection({
      loginUrl: 'https://trilogy-sales.my.salesforce.com'
    })

    await conn.login(
      process.env.SALESFORCE_USERNAME!,
      process.env.SALESFORCE_PASSWORD! + process.env.SALESFORCE_TOKEN!
    )

    // Search for opportunity by name — include Renewals section fields
    const result = await conn.query(`
      SELECT
        Id, Name, StageName, CloseDate, Amount,
        AccountId, Account.Name,
        Owner.Name, OwnerId,
        Type, LeadSource, Description,
        CreatedDate, LastModifiedDate,
        SBQQ__RenewedContract__c,
        Parent_Opportunity__c,
        Parent_Opportunity__r.Name,
        Auto_Renewed_Last_Term__c,
        Customer_Termination_Deadline__c,
        NS_Subscription_ID__c,
        NS_Parent_Subscription_ID__c,
        NS_Account_ID__c,
        NetSuite_Status__c,
        ARR__c,
        TCV__c
      FROM Opportunity
      WHERE Name LIKE '%${opportunityName.replace(/'/g, "\\'")}%'
      ORDER BY LastModifiedDate DESC
      LIMIT 10
    `).catch(async () => {
      // Fallback: query with only guaranteed standard fields if custom fields don't exist
      return conn.query(`
        SELECT
          Id, Name, StageName, CloseDate, Amount,
          AccountId, Account.Name,
          Owner.Name, OwnerId,
          Type, Description,
          CreatedDate, LastModifiedDate
        FROM Opportunity
        WHERE Name LIKE '%${opportunityName.replace(/'/g, "\\'")}%'
        ORDER BY LastModifiedDate DESC
        LIMIT 10
      `)
    })

    // Flatten nested fields from jsforce response
    const opportunities = result.records.map((r: any) => ({
      ...r,
      'Account.Name': r.Account?.Name || r['Account.Name'] || '',
      'Owner.Name': r.Owner?.Name || r['Owner.Name'] || '',
      'Parent_Opportunity__r.Name': r.Parent_Opportunity__r?.Name || r['Parent_Opportunity__r.Name'] || ''
    }))

    return NextResponse.json({ opportunities })
  } catch (error) {
    console.error('Salesforce error:', error)
    return NextResponse.json(
      { error: 'Failed to connect to Salesforce' },
      { status: 500 }
    )
  }
}
