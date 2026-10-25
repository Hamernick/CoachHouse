import { useState } from 'react'
import { Toaster } from 'sonner'
import { Button } from '../../../src/components/ui/button'
import { ResourceOpportunityMatches } from '../../../src/features/workspace-finance/components/resource-opportunity-matches'
export function MatchingFixture(){
 const [other,setOther]=useState(false)
 return <main className="mx-auto w-full max-w-md p-3 text-foreground"><p className="mb-3 text-xs">Fictional browser fixture. No external research or production data.</p><Button onClick={()=>setOther(!other)}>Switch resource</Button><ResourceOpportunityMatches target={{organizationId:'00000000-0000-4000-8000-000000000001',resourceId:`00000000-0000-4000-8000-00000000000${other?3:2}`,resourceRevision:0}} title={other?'Second resource':'Workshop'} canEdit onSaved={()=>undefined}/><Toaster/></main>
}
