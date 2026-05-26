import { calculateDiscounts } from './discount-calculator';

describe('calculateDiscounts', () => {
  test('No discounts: plain price × quantity', () => {
    const res = calculateDiscounts(
      [
        {
          unitPrice: 100,
          quantity: 2,
          gstRate: 0,
          itemDiscountType: 'NONE',
          itemDiscountValue: 0,
        },
      ],
      'NONE',
      0,
      false,
    );

    expect(res.items[0].baseLineTotal).toBe(200);
    expect(res.items[0].itemDiscountAmount).toBe(0);
    expect(res.items[0].discountedSubtotal).toBe(200);
    expect(res.items[0].gstAmount).toBe(0);
    expect(res.items[0].lineTotal).toBe(200);
    expect(res.subtotal).toBe(200);
    expect(res.preDiscountGrandTotal).toBe(200);
    expect(res.grandTotal).toBe(200);
  });

  test('PERCENTAGE item discount: 10% off ₹100×3 = ₹30 discount', () => {
    const res = calculateDiscounts(
      [
        {
          unitPrice: 100,
          quantity: 3,
          gstRate: 0,
          itemDiscountType: 'PERCENTAGE',
          itemDiscountValue: 10,
        },
      ],
      'NONE',
      0,
      false,
    );

    expect(res.items[0].baseLineTotal).toBe(300);
    expect(res.items[0].itemDiscountAmount).toBe(30);
    expect(res.items[0].discountedSubtotal).toBe(270);
  });

  test('FLAT item discount: ₹30 off ₹300 → ₹270', () => {
    const res = calculateDiscounts(
      [
        {
          unitPrice: 100,
          quantity: 3,
          gstRate: 0,
          itemDiscountType: 'FLAT',
          itemDiscountValue: 30,
        },
      ],
      'NONE',
      0,
      false,
    );

    expect(res.items[0].itemDiscountAmount).toBe(30);
    expect(res.items[0].discountedSubtotal).toBe(270);
  });

  test('FLAT item discount clamped: ₹500 flat on ₹200 → discount = 200', () => {
    const res = calculateDiscounts(
      [
        {
          unitPrice: 100,
          quantity: 2,
          gstRate: 0,
          itemDiscountType: 'FLAT',
          itemDiscountValue: 500,
        },
      ],
      'NONE',
      0,
      false,
    );

    expect(res.items[0].baseLineTotal).toBe(200);
    expect(res.items[0].itemDiscountAmount).toBe(200);
    expect(res.items[0].discountedSubtotal).toBe(0);
  });

  test('PERCENTAGE bill discount: 10% off ₹500 → ₹50 bill discount', () => {
    const res = calculateDiscounts(
      [
        {
          unitPrice: 500,
          quantity: 1,
          gstRate: 0,
          itemDiscountType: 'NONE',
          itemDiscountValue: 0,
        },
      ],
      'PERCENTAGE',
      10,
      false,
    );

    expect(res.preDiscountGrandTotal).toBe(500);
    expect(res.billDiscountAmount).toBe(50);
    expect(res.grandTotal).toBe(450);
  });

  test('FLAT bill discount clamped: ₹1000 on ₹500 → discount=500, grandTotal=0', () => {
    const res = calculateDiscounts(
      [
        {
          unitPrice: 500,
          quantity: 1,
          gstRate: 0,
          itemDiscountType: 'NONE',
          itemDiscountValue: 0,
        },
      ],
      'FLAT',
      1000,
      false,
    );

    expect(res.preDiscountGrandTotal).toBe(500);
    expect(res.billDiscountAmount).toBe(500);
    expect(res.grandTotal).toBe(0);
  });

  test('GST enabled: 18% GST on ₹270 discounted subtotal = ₹48.6', () => {
    const res = calculateDiscounts(
      [
        {
          unitPrice: 100,
          quantity: 3,
          gstRate: 18,
          itemDiscountType: 'FLAT',
          itemDiscountValue: 30,
        },
      ],
      'NONE',
      0,
      true,
    );

    // discountedSubtotal = 270
    expect(res.items[0].discountedSubtotal).toBe(270);
    expect(res.items[0].gstAmount).toBe(48.6);
    expect(res.items[0].lineTotal).toBe(318.6);
  });

  test('GST disabled: gstAmounts = 0', () => {
    const res = calculateDiscounts(
      [
        {
          unitPrice: 100,
          quantity: 3,
          gstRate: 18,
          itemDiscountType: 'NONE',
          itemDiscountValue: 0,
        },
      ],
      'NONE',
      0,
      false,
    );

    expect(res.items[0].gstAmount).toBe(0);
    expect(res.items[0].lineTotal).toBe(300);
  });

  test('100% percentage item discount → discountedSubtotal = 0', () => {
    const res = calculateDiscounts(
      [
        {
          unitPrice: 50,
          quantity: 4,
          gstRate: 0,
          itemDiscountType: 'PERCENTAGE',
          itemDiscountValue: 100,
        },
      ],
      'NONE',
      0,
      false,
    );

    expect(res.items[0].baseLineTotal).toBe(200);
    expect(res.items[0].itemDiscountAmount).toBe(200);
    expect(res.items[0].discountedSubtotal).toBe(0);
  });
});
