export function validCoordinates(lat:unknown,lng:unknown):boolean {
 return typeof lat==='number'&&typeof lng==='number'&&Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180
}
export function validateProfile(name:unknown,phone:unknown):{error:string}|{full_name:string;phone:string|null}{
 if(typeof name!=='string'||!name.trim()||name.trim().length>100||/[\u0000-\u001f]/.test(name))return {error:'Enter your full name (up to 100 characters).'}
 if(typeof phone!=='string')return {error:'Enter a valid phone number.'}
 const clean=phone.trim().replace(/[\s()-]/g,'')
 if(clean&&!/^\+?\d{7,15}$/.test(clean))return {error:'Enter a valid phone number, including the country code if outside the UK.'}
 return {full_name:name.trim().replace(/\s+/g,' '),phone:clean||null}
}
