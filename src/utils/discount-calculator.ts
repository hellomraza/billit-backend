export type DiscountType = 'NONE' | 'PERCENTAGE' | 'FLAT';

export interface ItemInput {
  unitPrice: number;
  quantity: number;
  gstRate: number; // 0,5,12,18,28
  itemDiscountType: DiscountType;
  itemDiscountValue: number;
}

export interface ItemResult {
  baseLineTotal: number;
  itemDiscountAmount: number;
  discountedSubtotal: number;
  gstAmount: number;
  lineTotal: number;
}

export interface BillResult {
  items: ItemResult[];
  subtotal: number;
  totalGstAmount: number;
  preDiscountGrandTotal: number;
  billDiscountAmount: number;
  grandTotal: number;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function calculateDiscounts(
  items: ItemInput[],
  billDiscountType: DiscountType,
  billDiscountValue: number,
  gstEnabled: boolean,
): BillResult {
  const results: ItemResult[] = [];

  for (const it of items) {
    const baseLineTotal = round2(it.unitPrice * it.quantity);

    let itemDiscountAmount = 0;
    if (it.itemDiscountType === 'PERCENTAGE') {
      itemDiscountAmount = baseLineTotal * (it.itemDiscountValue / 100);
    } else if (it.itemDiscountType === 'FLAT') {
      itemDiscountAmount = it.itemDiscountValue;
    }

    itemDiscountAmount = Math.min(itemDiscountAmount, baseLineTotal);
    itemDiscountAmount = round2(itemDiscountAmount);

    const discountedSubtotal = round2(baseLineTotal - itemDiscountAmount);

    const gstAmount = round2(
      gstEnabled ? discountedSubtotal * (it.gstRate / 100) : 0,
    );

    const lineTotal = round2(discountedSubtotal + gstAmount);

    results.push({
      baseLineTotal,
      itemDiscountAmount,
      discountedSubtotal,
      gstAmount,
      lineTotal,
    });
  }

  const subtotal = round2(
    results.reduce((s, r) => s + r.discountedSubtotal, 0),
  );
  const totalGstAmount = round2(results.reduce((s, r) => s + r.gstAmount, 0));
  const preDiscountGrandTotal = round2(subtotal + totalGstAmount);

  let billDiscountAmount = 0;
  if (billDiscountType === 'PERCENTAGE') {
    billDiscountAmount = preDiscountGrandTotal * (billDiscountValue / 100);
  } else if (billDiscountType === 'FLAT') {
    billDiscountAmount = billDiscountValue;
  }

  billDiscountAmount = Math.min(billDiscountAmount, preDiscountGrandTotal);
  billDiscountAmount = round2(billDiscountAmount);

  const grandTotal = round2(preDiscountGrandTotal - billDiscountAmount);

  return {
    items: results,
    subtotal,
    totalGstAmount,
    preDiscountGrandTotal,
    billDiscountAmount,
    grandTotal,
  };
}

export default calculateDiscounts;
