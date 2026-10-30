// Fuentes de operadores consultadas el 23 de octubre de 2026.
// Solo se incorporan como datos de ruta los códigos que también están respaldados
// por AMB/SIBUS. Las páginas de operador sirven para documentar presencia y
// disponibilidad de información, no para completar recorridos ausentes.
const OPERATOR_SOURCES = [
  {name:'Coochofal', url:'https://coochofal.com/nosotros/', kind:'operador privado', status:'verificada', evidence:'Declara servicio urbano en Barranquilla y parte de Soledad; no expone un listado de recorridos legible en la página consultada.'},
  {name:'Cootrasol', url:'https://cootrasol.com.co/', kind:'operador privado', status:'verificada', evidence:'Declara cuatro rutas; la página consultada no entrega nombres o geometrías de esas rutas en texto utilizable para Movix.'},
  {name:'Coolitoral', url:'https://coolitoral.com/pages/quienes-somos.html', kind:'operador privado', status:'verificada', evidence:'Declara transporte público colectivo en Barranquilla y su área metropolitana; no se encontró un catálogo de recorridos legible en la página consultada.'},
  {name:'SIBUS / AMB', url:'https://sibusoficial.ambq.gov.co/', kind:'fuente institucional', status:'verificada', evidence:'Lista empresas del TPC y presenta el sistema integrado de recaudo e información.'},
  {name:'AMB — resoluciones de rutas', url:'https://www.ambq.gov.co/transporte/transporte-publico-colectivo/', kind:'fuente oficial de gobierno', status:'verificada', evidence:'Publica resoluciones y empresas; es la fuente usada para los códigos AMB del catálogo.'},
  {name:'Transmetro', url:'https://transmetro.gov.co/', kind:'operador público', status:'verificada', evidence:'Fuente de códigos y destinos del catálogo Transmetro.'}
];

const BUS_PHOTO_SOURCES = [
  {label:'Bus de Transmetro en Barranquilla', url:'https://commons.wikimedia.org/wiki/File:Bus_de_Transmetro-Barranquilla-20250521.jpg', consulted:'2026-10-23', license:'CC BY 4.0', attribution:'Jdvillalobos / Wikimedia Commons', status:'usable con atribución'},
  {label:'Fotos de buses de operadores privados', url:'', consulted:'2026-10-23', license:'pendiente de verificar', attribution:'No se incorporan al prototipo hasta confirmar licencia y autoría', status:'pendiente'}
];
