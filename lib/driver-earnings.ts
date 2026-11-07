/** New jobs keep their agreed quote; historical jobs retain their original 75% policy. */
export function driverEarning(order: {
  price: number | null;
  driver_earning_quote?: number | null;
}): number {
  return (
    Math.round(
      Number(order.driver_earning_quote ?? Number(order.price ?? 0) * 0.75) *
        100,
    ) / 100
  );
}

const pounds = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" })
export function formatDriverGBP(value: number | null | undefined): string {
  return value != null && Number.isFinite(Number(value)) ? pounds.format(Number(value)) : "—"
}
