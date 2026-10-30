// Datos consultados el 22 de octubre de 2026.
// AMB publica códigos y empresas en su Visor de Rutas; Transmetro publica
// códigos y nombres de sus alimentadoras en su sitio oficial.
const OFFICIAL_SOURCES = {
  amb: 'https://www.ambq.gov.co/transporte/transporte-publico-colectivo/',
  transmetro: 'https://transmetro.gov.co/',
  transmetroSchedules: 'https://apiwebtm.com/uploads/HORARIO_DIAS_HABILES_9d41cf8642.pdf',
  photo: 'https://commons.wikimedia.org/wiki/File:Bus_de_Transmetro-Barranquilla-20250521.jpg'
};

const AMB_ROUTE_ROWS = [
  ['FLOTA-ANGULO','A7-4112'],['TRANSMECAR','C17-4160'],['TRANSMECAR','D10-4172'],['TRANSMECAR','D11-4153'],['TRANSMECAR','D9-4152'],['FLOTA-ROJA','A8-4113'],
  ['TRANSDIAZ','A10-4114 A'],['TRANSDIAZ','A10-4114 B'],['TRANSDIAZ','A11-4115'],['TRANSDIAZ','B16-4130'],['COOTRAB','C5-4135'],['COOTRAB','C6-4137'],['EMBUSA','B9-4125'],
  ['MONTERREY','B11-4166'],['MONTERREY','B12-4127'],['MONTERREY','B8-4124'],['MONTERREY','B11-B-4192'],['LA-CAROLINA','A16-4161 A'],['LA-CAROLINA','A16-4161 B'],['LA-CAROLINA','D6-4150'],['LA-CAROLINA','D7-4151'],
  ['COOTRANSPORCAR','C8-4139'],['COOCHOFAL','A15-4159'],['COOCHOFAL','C2-4133'],['COOCHOFAL','C2-B-4187'],['COOCHOFAL','C3-4134'],['COOCHOFAL','C4-4135'],['COOCHOFAL','C9-4140'],['COOCHOFAL','C18-4141'],['COOCHOFAL','D20-4185'],
  ['TRASALFA','D15-4157'],['TRASALFA','D14-4156'],['TRASALFA','B2-B-4118'],['COOLITORAL','A1-4106 A'],['COOLITORAL','A1-4106 B'],['COOLITORAL','A2-4107'],['COOLITORAL','A3-4108'],['COOLITORAL','A4-4109'],['COOLITORAL','B1-4117'],['COOLITORAL','B2A-4177'],['COOLITORAL','B3-4119'],['COOLITORAL','B17-4163'],['COOLITORAL','C19-4178'],['COOLITORAL','PT1-4101'],['COOLITORAL','PT2-4102'],['COOLITORAL','PT3-4103'],['COOLITORAL','PT4-4104'],['COOLITORAL','PT5-4105'],
  ['COOTRANTICO','A18-4183'],['COOTRANTICO','B4-4120'],['COOTRANTICO','B5-4121'],['COOTRANTICO','B5-B-4190'],['COOTRANTICO','B6-4122'],['COOTRANTICO','B7-4123'],['COOTRANTICO','B20-4180'],['COOTRANTICO','B20-B-4191'],['LOLAYA','B10-4126'],['LOLAYA','B10-B-4193'],['LOLAYA','D8-4165'],['COOTRANSCO','C7-4138'],['COOTRASOL','D3-4147'],['COOTRASOL','D4-4148'],['COOTRASOL','D5-4149'],
  ['SOBUSA','B18-4175 A'],['SOBUSA','B18-4175 B'],['SOBUSA','C11-4168'],['SOBUSA','C12-4169 A'],['SOBUSA','C12-4169 B'],['SOBUSA','C13-4143'],['SOBUSA','C14-4170'],['SOBUSA','C16-4167 A'],['SOBUSA','C16-4167 B'],['TRANSOLEDAD','D13-4155'],['TRANSURBAR','A14-4116'],['TRANSURBAR','D19-4184'],['TRANSURBAR','D16-4173'],['SODETRANS','B13-4128'],['SODETRANS','B13-B-4189'],['SODETRANS','B14-4174'],['SODETRANS','B15-4129 A'],['SODETRANS','B15-4129 B'],['SODETRANS','C21-4182 A'],['SODETRANS','C21-4182 B'],['COOTRANSNORTE','A6-4111'],['COOTRANSNORTE','A5-4110'],['TRASALIANCO','B19-4176'],['TRASALIANCO','D18-4179'],['TRASALIANCO','D12-4154'],['TRASALIANCO','D17-4158'],['COOASOATLAN','C1-4132'],['COOASOATLAN','C1-B-4186'],['COOASOATLAN','C20-4181'],['COOASOATLAN','C20-B-4187']
].map(([operator,id]) => ({id, operator, system:'TPC AMB', source:OFFICIAL_SOURCES.amb, destination:''}));

const TRANSMETRO_ROUTE_ROWS = [
  ['A1-2','Carrera Ocho'],['A1-3','Galán'],['A1-4','La Magdalena'],['A2-1','Hipódromo'],['A3-1','Villa Katanga'],['A3-2','Soledad 2000'],['A3-3','Manuela Beltrán'],['A3-4','Villa Sol'],['A3-41','Villa Karla'],['A5-1','Los Robles / Los Almendros'],['A5-2','Las Moras'],['A5-3','La Central'],['A5-4','San Antonio'],['A5-5','Manantial'],['A6-5','Carrizal'],['A6-6','Ciudadela'],['A7-1','Miramar'],['A7-3','Carrera 38'],['A7-4','Los Andes'],['A8-1','Paraíso'],['A8-2','Vía 40'],['A8-3','Prado'],['A9-3','Buenavista'],['A9-4','Carrera 46 / fines de semana'],['U-30','Universidades'],['A4-1','Malambo'],['GM','Gran Malecón'],['RC','Ruta Chévere']
].map(([id,destination]) => ({id, operator:'Transmetro', system:'Transmetro', source:OFFICIAL_SOURCES.transmetro, destination}));

const OFFICIAL_ROUTES = [...TRANSMETRO_ROUTE_ROWS, ...AMB_ROUTE_ROWS];
const OFFICIAL_ROUTE_COUNT = OFFICIAL_ROUTES.length;
