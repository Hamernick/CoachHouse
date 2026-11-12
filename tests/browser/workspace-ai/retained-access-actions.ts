export async function listRetainedWorkspaceAccess(input: unknown) {
 const response=await fetch("/__fixture/retained-access",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input)})
 return response.json()
}
