/**
 * Lista de artículos digitales permitidos (73 items).
 * Solo los artículos digitales (que contengan "DIG" en su ItemCode) que estén en esta lista
 * serán mostrados. Los artículos NO digitales pasan sin filtro.
 */
export const ALLOWED_DIGITAL_ITEM_CODES = new Set([
  'BF-DIG-01-MR',
  'BF-DIG-01-MX',
  'BF-DIG-01-PB',
  'BF-DIG-02-MX',
  'BF-DIG-03-MX',
  'BF-DIG-04-MX',
  'BF-DIG-MX',
  'BF-DIG-PRG-PB',
  'BF-ES-DIG-EM',
  'BF-ES-DIG-PB',
  'BF-IMU-DIG',
  'BF-MUP-DIG',
  'BF-P1-DIG-EM',
  'BF-P1-DIG-GD',
  'BF-P1-DIG-MD',
  'BF-P1-DIG-MX',
  'BF-P1-DIG-MY',
  'CT-DIG-01-MR',
  'CT-DIG-01-MX',
  'CT-DIG-01-PB',
  'CT-DIG-02-MX',
  'CT-DIG-03-MX',
  'CT-DIG-04-MX',
  'CT-DIG-MX',
  'CT-ES-DIG-EM',
  'CT-ES-DIG-PB',
  'CT-P1-DIG-GD',
  'CT-P1-DIG-MX',
  'CT-P1-DIG-MY',
  'ES-DIG-01-MR',
  'ES-ES-DIG-EM',
  'ES-ES-DIG-PB',
  'ES-P1-DIG-GD',
  'ES-P1-DIG-MX',
  'IM-DIG-01-MR',
  'IM-ES-DIG-EM',
  'IM-ES-DIG-PB',
  'IM-P1-DIG-GD',
  'IM-P1-DIG-MX',
  'IN-DIG-01-MR',
  'IN-DIG-01-MX',
  'IN-DIG-01-PB',
  'IN-DIG-02-MX',
  'IN-DIG-03-MX',
  'IN-DIG-04-MX',
  'IN-DIG-MX',
  'IN-DIG-PRG-PB',
  'IN-ES-DIG-EM',
  'IN-ES-DIG-PB',
  'IN-P1-DIG-GD',
  'IN-P1-DIG-MX',
  'IN-P1-DIG-MY',
  'PQ-MND-GOLD-DIG-GD',
  'PQ-MND-GOLD-DIG-MX',
  'PQ-MND-GOLD-DIG-MY',
  'RP-DIG-MX',
  'RT-DIG-01-MR',
  'RT-DIG-01-MX',
  'RT-DIG-01-PB',
  'RT-DIG-02-MX',
  'RT-DIG-03-MX',
  'RT-DIG-04-MX',
  'RT-DIG-MX',
  'RT-DIG-PRG-PB',
  'RT-ES-DIG-EM',
  'RT-ES-DIG-PB',
  'RT-GDL-WIFI-DIG',
  'RT-IMU-DIG',
  'RT-MUP-DIG',
  'RT-P1-DIG-GD',
  'RT-P1-DIG-MD',
  'RT-P1-DIG-MX',
  'RT-P1-DIG-MY',
]);

/**
 * Filtra artículos SAP: deja pasar todos los NO digitales,
 * y de los digitales solo los que están en la lista permitida.
 */
export function filterAllowedArticulos<T extends { ItemCode: string }>(articulos: T[]): T[] {
  return articulos.filter(a => {
    const isDigital = a.ItemCode.toUpperCase().includes('DIG');
    if (!isDigital) return true;
    return ALLOWED_DIGITAL_ITEM_CODES.has(a.ItemCode);
  });
}
