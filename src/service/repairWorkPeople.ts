export const workPersonKey = (person: any) => `${person.personType}:${person.sourcePersonId}`

export const isWorkSelf = (person: any, actorId: unknown) => person.personType === 'INTERNAL' && actorId != null && String(actorId).trim() !== '' &&
  [person.sourcePersonId, person.userId].some(id => id != null && String(id).trim() === String(actorId).trim())

/** personOptions is the server-authorized, approved ACTIVE roster, not all users. */
export function workPersonChoices(options: any[], ownerId: string, actorId: string) {
  return [...new Map(options.filter(person =>
    ['INTERNAL', 'EXTERNAL'].includes(person.personType) && person.sourcePersonId &&
    (person.memberStatus == null || person.memberStatus === 'ACTIVE') &&
    !isWorkSelf(person, ownerId) && !isWorkSelf(person, actorId)
  ).map(person => [workPersonKey(person), { ...person, key: workPersonKey(person), label: person.name || '名称未返回' }])).values()]
}

export function selectWorkPeople(current: any[], choices: any[], type: string, keys: string[]) {
  return [...current.filter(person => person.personType !== type), ...choices
    .filter(person => person.personType === type && keys.includes(person.key))
    .map(({ key, label, ...person }) => ({...person,...current.find(old => workPersonKey(old) === key)}))]
}

export function repairOutsources(persons: any[], members: any[], draftOnly = false) {
  return persons.filter(p => p.personType === 'EXTERNAL').map(person => {
    const memberId = person.outsourceMemberId || members.find(m => m.personType === 'EXTERNAL' && m.sourcePersonId === person.sourcePersonId && m.memberStatus === 'ACTIVE')?.id
    if (!memberId) throw new Error('外协成员记录ID未返回，请刷新日志后重试')
    const headcount = person.headcount === '' || person.headcount == null ? null : Number(person.headcount)
    const workHours = person.workHours === '' || person.workHours == null ? null : Number(person.workHours)
    if ((!draftOnly || headcount != null) && (!Number.isInteger(headcount) || headcount! <= 0)) throw new Error('请填写大于0的外协实际人数（整数）')
    if ((!draftOnly || workHours != null) && (!Number.isFinite(workHours) || workHours! <= 0)) throw new Error('请填写大于0的外协实际工时')
    return {outsourceMemberId:memberId,headcount,workHours,...(person.remark?.trim() ? {remark:person.remark.trim()} : {})}
  })
}
export function restoreRepairPeople(data: any, members: any[]) {
  const persons = (data.persons || []).map((p:any) => ({...p}))
  for (const row of data.outsources || []) {
    const member = members.find(m => m.id === row.outsourceMemberId)
    const person = persons.find((p:any) => p.personType === 'EXTERNAL' && (p.outsourceMemberId === row.outsourceMemberId || member && p.sourcePersonId === member.sourcePersonId))
    if (person) Object.assign(person,row)
    else persons.push({...row,personType:'EXTERNAL',sourcePersonId:member?.sourcePersonId || '',name:row.unitName || member?.personNameSnapshot || '历史外协单位'})
  }
  return persons
}
