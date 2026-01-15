/**
 * @param {string|number} number
 * @param {string|undefined} [format]
 */
export function formatNumber(number, format = undefined) {
    if (format) {
        return new Intl.NumberFormat('no', {
            style: 'unit',
            unit: format,
            maximumFractionDigits: Number(number) < 1 && format === 'millimeter' ? 1 : 0
        }).format(Number(number));
    }
    return new Intl.NumberFormat('no', {maximumFractionDigits: 0}).format(Number(number));


}