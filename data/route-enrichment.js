// Denominaciones publicadas por AMB en notas y resoluciones consultadas el 23/10/2026.
// Se guardan como nombres de referencia para el usuario; no se presentan como
// nombre frontal del vehículo si la fuente no lo afirma expresamente.
const ROUTE_ENRICHMENT = {
  'A2-4107': {publicName:'Riomar – Villa Carolina – Corredor Universitario – Carrera 38', aliases:['Riomar','Villa Carolina','Corredor Universitario'], source:'https://www.ambq.gov.co/amb-desvia-22-rutas-de-buses-por-obras-del-arroyo-de-la-felicidad/'},
  'A3-4108': {publicName:'Calle 17 – Zona Franca – Centro – Los Nogales', aliases:['Zona Franca','Los Nogales'], source:'https://www.ambq.gov.co/amb-desvia-22-rutas-de-buses-por-obras-del-arroyo-de-la-felicidad/'},
  'A4-4109': {publicName:'Calle 17 – Centro – Calle 76 – Los Nogales', aliases:['Calle 76','Los Nogales'], source:'https://www.ambq.gov.co/amb-desvia-22-rutas-de-buses-por-obras-del-arroyo-de-la-felicidad/'},
  'A6-4111': {publicName:'Urbanización La Playa – Vía 40 – Prado – Centro', aliases:['La Playa','Vía 40','Prado'], source:'https://www.ambq.gov.co/amb-desvia-22-rutas-de-buses-por-obras-del-arroyo-de-la-felicidad/'},
  'A7-4112': {publicName:'Barranquillita – Carrera 43 – La Pradera', aliases:['Barranquillita','La Pradera'], source:'https://www.ambq.gov.co/amb-desvia-22-rutas-de-buses-por-obras-del-arroyo-de-la-felicidad/'},
  'A8-4113': {publicName:'Urbanización La Arboleda – Centro – Calle 84 – Vía 40 – Prado', aliases:['La Arboleda','Calle 84'], source:'https://www.ambq.gov.co/amb-desvia-22-rutas-de-buses-por-obras-del-arroyo-de-la-felicidad/'},
  'A11-4115': {publicName:'Soledad – Circunvalar – Malvinas – Ciudad Jardín – Villa Carolina – Centro', aliases:['Malvinas','Ciudad Jardín'], source:'https://www.ambq.gov.co/amb-desvia-22-rutas-de-buses-por-obras-del-arroyo-de-la-felicidad/'},
  'B3-4119': {publicName:'Villas de San Pablo – Urbanización El Pueblo', aliases:['Villas de San Pablo','El Pueblo'], source:'https://www.ambq.gov.co/amb-desvia-22-rutas-de-buses-por-obras-del-arroyo-de-la-felicidad/'},
  'B4-4120': {publicName:'Barranquillita – Cordialidad – Villas de la Cordialidad', aliases:['Cordialidad','Villas de la Cordialidad'], source:'https://www.ambq.gov.co/amb-desvia-22-rutas-de-buses-por-obras-del-arroyo-de-la-felicidad/'},
  'B6-4122': {publicName:'Barranquillita – Prado – La Manga – Ciudad Caribe', aliases:['La Manga','Ciudad Caribe'], source:'https://www.ambq.gov.co/amb-desvia-22-rutas-de-buses-por-obras-del-arroyo-de-la-felicidad/'},
  'B18-4175 A': {publicName:'Granabastos – Las Flores – La Playa – Circular', aliases:['Granabastos','Las Flores'], source:'https://www.ambq.gov.co/wp-content/uploads/2024/12/RESOLUCION-METROPOLITANA-349-24.pdf'},
  'C5-4136': {publicName:'La Arboleda – Galán – Universidades CUC – Los Andes – Las Nieves – Simón Bolívar – Urbanización El Parque', aliases:['Galán','Los Andes','Las Nieves'], source:'https://www.ambq.gov.co/amb-desvia-22-rutas-de-buses-por-obras-del-arroyo-de-la-felicidad/'},
  'C6-4137': {publicName:'La Arboleda – Las Trinitarias – Las Gaviotas – Simón Bolívar – Las Nieves – Universidades CUC – Vía 40 – Calle 72', aliases:['Las Trinitarias','Las Gaviotas','Universidades CUC'], source:'https://www.ambq.gov.co/amb-desvia-22-rutas-de-buses-por-obras-del-arroyo-de-la-felicidad/'},
  'C8-4139': {publicName:'Terminal – Simón Bolívar – Centro – Vía 40 – Corredor Universitario – Circular', aliases:['Terminal','Simón Bolívar','Corredor Universitario'], source:'https://www.ambq.gov.co/wp-content/uploads/2025/10/Resolucion-Metropolitana-No.-389-2025-OPERACION-DE-RUTA-C8-4139-COOTRANSPORCAR.pdf', nameStatus:'referencia derivada del recorrido oficial'},
  'C12-4169 A': {publicName:'Granabastos – Vivero – Paraíso', aliases:['Vivero','Paraíso'], source:'https://www.ambq.gov.co/amb-desvia-22-rutas-de-buses-por-obras-del-arroyo-de-la-felicidad/'},
  'C13-4143': {publicName:'Granabastos – Carrera 50 – Paraíso', aliases:['Paraíso','Carrera 50'], source:'https://www.ambq.gov.co/amb-desvia-22-rutas-de-buses-por-obras-del-arroyo-de-la-felicidad/'},
  'C14-4170': {publicName:'Granabastos – Carrera 54 – Uninorte – La Playa', aliases:['Uninorte','La Playa'], source:'https://www.ambq.gov.co/amb-desvia-22-rutas-de-buses-por-obras-del-arroyo-de-la-felicidad/'},
  'D5-4149': {publicName:'Barrio La Popa (Malambo) – Soledad – Centro', aliases:['La Popa','Malambo'], source:'https://www.ambq.gov.co/amb-desvia-22-rutas-de-buses-por-obras-del-arroyo-de-la-felicidad/'},
  'D11-4153': {publicName:'Malambo – Calle 17 – Barrio Abajo – Universidad Simón Bolívar – CUC', aliases:['Barrio Abajo','Universidad Simón Bolívar'], source:'https://www.ambq.gov.co/amb-desvia-22-rutas-de-buses-por-obras-del-arroyo-de-la-felicidad/'},
  'D12-4154': {publicName:'Malambo – Centro – Carrera 53 – Prado – Calle 76', aliases:['Carrera 53'], source:'https://www.ambq.gov.co/amb-desvia-22-rutas-de-buses-por-obras-del-arroyo-de-la-felicidad/'},
  'D13-4155': {publicName:'Soledad – Centro – Universidad Simón Bolívar – CUC', aliases:['Soledad','Universidad Simón Bolívar'], source:'https://www.ambq.gov.co/amb-desvia-22-rutas-de-buses-por-obras-del-arroyo-de-la-felicidad/'},
  'D17-4158': {publicName:'Urbanización El Concorde (Malambo) – Centro – Calle 53 – Universidad CUC', aliases:['El Concorde','Calle 53'], source:'https://www.ambq.gov.co/amb-desvia-22-rutas-de-buses-por-obras-del-arroyo-de-la-felicidad/'},
  'U-30': {publicName:'Universidades', aliases:['Universidad del Norte','Universidades'], source:'https://transmetro.gov.co/'}
};

const GENERIC_TPC_PHOTO = {
  url:'https://commons.wikimedia.org/wiki/Special:FilePath/Barranquilla_-_Bus_-_20050428.jpg?width=900',
  page:'https://commons.wikimedia.org/wiki/File:Barranquilla_-_Bus_-_20050428.jpg',
  attribution:'Moyogo / Denis Jacquerye, Wikimedia Commons',
  license:'CC BY 2.5 / CC BY-SA 3.0',
  note:'Foto histórica de un bus urbano de Barranquilla; no identifica una empresa ni una ruta específica.'
};

for(const r of OFFICIAL_ROUTES){
  const e=ROUTE_ENRICHMENT[r.id]||ROUTE_ENRICHMENT[r.id.replace(/ [AB]$/,'')];
  if(e){Object.assign(r,e);}
  r.publicName=r.publicName||r.destination||'';
  r.aliases=r.aliases||[];
  r.nameStatus=r.nameStatus|| (r.publicName?'denominación publicada':'pendiente de verificar');
  r.photo=r.system==='Transmetro'?BUS_PHOTO_SOURCES[0]:GENERIC_TPC_PHOTO;
}
