/**
 * Telegram message templates, format prompts, and menu builders.
 * Pure string builders extracted verbatim from the webhook route —
 * no database, network, or request access. User-facing copy stays
 * bilingual (English + Burmese) by design.
 */
export const COMMERCE_REPORT_MODES = ["demand_report", "customer_service", "finance_transactions", "inventory_import", "marketing_import"] as const;

export function isCommerceReportMode(mode: string | null | undefined) {
  return !!mode && COMMERCE_REPORT_MODES.includes(mode as (typeof COMMERCE_REPORT_MODES)[number]);
}
export function getPlainTemplateTextForMode(mode: string | null | undefined): string {
  switch (mode) {
    case 'customer_service':
      return [
        "Date:",
        "Customer Name:",
        "Company:",
        "Phone:",
        "Email:",
        "Purchased Product:",
        "Purchase Amount MMK:",
        "Status:",
        "Next Follow Up:",
        "CSAT:",
        "Last Contact Note:",
      ].join("\n");
    case 'finance_transactions':
      return [
        "Date:",
        "Description:",
        "Category:",
        "Type:",
        "Amount (MMK):",
        "Payment Method:",
        "Reference:",
        "Notes:",
      ].join("\n");
    case 'inventory_import':
      return [
        "Product Code:",
        "Product Name:",
        "Category:",
        "Unit Cost:",
        "Selling Price:",
        "Stock Qty:",
        "Low Stock Threshold:",
      ].join("\n");
    case 'marketing_import':
      return [
        "Date:",
        "Channel:",
        "Spend:",
        "Reach:",
        "Impressions:",
        "Ad-driven Orders:",
        "Notes:",
      ].join("\n");
    case 'demand_report':
    default:
      return [
        "Date:",
        "Customer Name:",
        "Phone:",
        "Product Name:",
        "Product Code:",
        "Quantity:",
        "Unit Price:",
        "Note:",
      ].join("\n");
  }
}
export function buildFormatInlineButtons(mode: string | null | undefined) {
  return {
    inline_keyboard: [
      [
        { text: "📋 Template ကူးယူရန်", copy_text: { text: getPlainTemplateTextForMode(mode) } },
        { text: "↩️ Main Menu", callback_data: "action:menu" },
      ],
    ],
  };
}
export function buildMainMenuButtons(allowedDepartments: string[]) {
  const buttons: { text: string; callback_data: string }[][] = [];
  const row1: { text: string; callback_data: string }[] = [];
  const row2: { text: string; callback_data: string }[] = [];
  const row3: { text: string; callback_data: string }[] = [];
  const row4: { text: string; callback_data: string }[] = [];

  if (allowedDepartments.includes('QA')) {
    row1.push({ text: "🤖 Q&A မေးမြန်း", callback_data: "mode:qa" });
  }
  if (allowedDepartments.includes('Sales')) {
    row1.push({ text: "📈 Sales Orders", callback_data: "mode:demand_report" });
    row2.push({ text: "🎧 Customer Service", callback_data: "mode:customer_service" });
    row3.push({ text: "📦 Inventory / Products", callback_data: "mode:inventory_import" });
    row4.push({ text: "📣 Marketing Metrics", callback_data: "mode:marketing_import" });
  }
  if (allowedDepartments.includes('Finance')) {
    row2.push({ text: "💳 Finance Transactions", callback_data: "mode:finance_transactions" });
  }

  if (row1.length) buttons.push(row1);
  if (row2.length) buttons.push(row2);
  if (row3.length) buttons.push(row3);
  if (row4.length) buttons.push(row4);

  return { inline_keyboard: buttons };
}
export function getDepartmentForMode(mode: string): string | null {
  if (mode === 'demand_report' || mode === 'customer_service' || mode === 'inventory_import' || mode === 'marketing_import') return 'Sales';
  if (mode === 'finance_transactions') return 'Finance';
  if (mode === 'qa') return 'QA';
  return null;
}
export function getDepartmentNameBurmese(dep: string): string {
  if (dep === 'Sales') return 'Sales & Marketing (အရောင်းနှင့်စျေးကွက်)';
  if (dep === 'Finance') return 'Finance & Operations (ဘဏ္ဍာရေးနှင့် လုပ်ငန်းဆောင်ရွက်မှု)';
  if (dep === 'QA') return 'QA / Support (အမေးအဖြေ)';
  return dep;
}
export function getFormatPrompt(): string {
  return [
    "📈 ━━━━━━━━━━━━━━━━━━━━",
    "",
    "  <b>Sales Orders Mode</b>",
    "  <i>Order / lead မှတ်တမ်း</i>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    "📄 စာသား <b>သို့မဟုတ်</b> Excel/CSV",
    "    ဖိုင်ကို တိုက်ရိုက်ပို့နိုင်ပါသည်",
    "",
    "📝 <b>စာသားပုံစံ:</b>",
    "<pre>",
    "• Date: [YYYY-MM-DD]",
    "• Customer Name: [နာမည်]",
    "• Phone: [ဖုန်းနံပါတ်]",
    "• Product Name: [ပစ္စည်းအမည်]",
    "• Product Code: [SKU]",
    "• Quantity: [အရေအတွက်]",
    "• Unit Price: [တစ်ခုဈေး]",
    "• Note: [မှတ်ချက်]",
    "</pre>",
    "",
    "📊 <b>Excel columns:</b>",
    "<pre>Date | Customer Name | Phone | Product Name | Product Code | Quantity | Unit Price | Stage | Fulfillment Status | Notes</pre>",
    "",
    "💡 <i>Stage: New Lead / Quoted / Pending / Won / Lost</i>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");
}
export function getCustomerServiceFormatPrompt(): string {
  return [
    "🎧 ━━━━━━━━━━━━━━━━━━━━",
    "",
    "  <b>Customer Service Mode</b>",
    "  <i>ဝယ်ယူပြီး customer service / follow-up မှတ်တမ်း</i>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    "📄 စာသား <b>သို့မဟုတ်</b> Excel/CSV",
    "    ဖိုင်ကို တိုက်ရိုက်ပို့နိုင်ပါသည်",
    "",
    "📝 <b>စာသားပုံစံ:</b>",
    "<pre>",
    "• Date: [YYYY-MM-DD]",
    "• Customer Name: [နာမည်]",
    "• Company: [ကုမ္ပဏီအမည်]",
    "• Phone: [ဖုန်းနံပါတ်]",
    "• Email: [email]",
    "• Purchased Product: [ဝယ်ယူထားသော ပစ္စည်း]",
    "• Purchase Amount MMK: [ငွေ]",
    "• Status: [active / pending / closed]",
    "• Next Follow Up: [YYYY-MM-DD]",
    "• CSAT: [အမှတ်]",
    "• Last Contact Note: [မှတ်ချက်]",
    "</pre>",
    "",
    "📊 <b>Excel columns:</b>",
    "<pre>Date | Customer Name | Company | Phone | Email | Purchased Product | Purchase Amount (MMK) | Status | Next Follow Up | CSAT | Last Contact Note</pre>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");
}
export function getFinanceTransactionsFormatPrompt(): string {
  return [
    "💳 ━━━━━━━━━━━━━━━━━━━━",
    "",
    "  <b>Finance Transactions Mode</b>",
    "  <i>ငွေဝင်/ငွေထွက် မှတ်တမ်း</i>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    "📄 စာသား <b>သို့မဟုတ်</b> Excel/CSV",
    "    ဖိုင်ကို တိုက်ရိုက်ပို့နိုင်ပါသည်",
    "",
    "📝 <b>စာသားပုံစံ:</b>",
    "<pre>",
    "• Date: [YYYY-MM-DD]",
    "• Description: [အကြောင်းအရာ]",
    "• Category: [အမျိုးအစား]",
    "• Type: [Income / Expense]",
    "• Amount (MMK): [ငွေပမာဏ]",
    "• Payment Method: [Cash / Bank / KPay]",
    "• Reference: [ရည်ညွှန်းနံပါတ်]",
    "• Notes: [မှတ်ချက်]",
    "</pre>",
    "",
    "📊 <b>Excel columns:</b>",
    "<pre>Date | Description | Category | Type | Amount (MMK) | Payment Method | Reference | Notes</pre>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");
}
export function getInventoryImportFormatPrompt(): string {
  return [
    "📦 ━━━━━━━━━━━━━━━━━━━━",
    "",
    "  <b>Inventory / Products Mode</b>",
    "  <i>Product Catalog / Stock တင်သွင်းခြင်း</i>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    "📄 စာသား <b>သို့မဟုတ်</b> Excel/CSV",
    "    ဖိုင်ကို တိုက်ရိုက်ပို့နိုင်ပါသည်",
    "",
    "📝 <b>စာသားပုံစံ:</b>",
    "<pre>",
    "• Product Code: [SKU]",
    "• Product Name: [ပစ္စည်းအမည်]",
    "• Category: [အမျိုးအစား]",
    "• Unit Cost: [အရင်းဈေး]",
    "• Selling Price: [ရောင်းဈေး]",
    "• Stock Qty: [လက်ကျန်အရေအတွက်]",
    "• Low Stock Threshold: [အနည်းဆုံးသတ်မှတ်]",
    "</pre>",
    "",
    "📊 <b>Excel columns:</b>",
    "<pre>Product Code | Product Name | Category | Unit Cost | Selling Price | Stock Qty | Low Stock Threshold</pre>",
    "",
    "💡 <i>Product Code (SKU) တူပါက အချက်အလက်အသစ်များဖြင့် update လုပ်ပါမည်။</i>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");
}
export function getMarketingImportFormatPrompt(): string {
  return [
    "📣 ━━━━━━━━━━━━━━━━━━━━",
    "",
    "  <b>Marketing Metrics Mode</b>",
    "  <i>ကြော်ငြာစရိတ် / ရလဒ် တင်သွင်းခြင်း</i>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "",
    "📄 စာသား <b>သို့မဟုတ်</b> Excel/CSV",
    "    ဖိုင်ကို တိုက်ရိုက်ပို့နိုင်ပါသည်",
    "",
    "📝 <b>စာသားပုံစံ:</b>",
    "<pre>",
    "• Date: [YYYY-MM-DD]",
    "• Channel: [Facebook / TikTok / Viber]",
    "• Spend: [သုံးစွဲငွေ]",
    "• Reach: [ထိတွေ့မှုအရေအတွက်]",
    "• Impressions: [ကြော်ငြာပြသမှု]",
    "• Ad-driven Orders: [ရရှိသော order]",
    "• Notes: [မှတ်ချက်]",
    "</pre>",
    "",
    "📊 <b>Excel columns:</b>",
    "<pre>Date | Channel | Spend | Reach | Impressions | Ad-driven Orders | Notes</pre>",
    "",
    "💡 <i>Channel ဥပမာ - Facebook Ads၊ TikTok Ads၊ Viber</i>",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");
}
export function getFormatPromptForMode(mode: string | null | undefined): string {
  switch (mode) {
    case 'customer_service':
      return getCustomerServiceFormatPrompt();
    case 'finance_transactions':
      return getFinanceTransactionsFormatPrompt();
    case 'demand_report':
      return getFormatPrompt();
    case 'inventory_import':
      return getInventoryImportFormatPrompt();
    case 'marketing_import':
      return getMarketingImportFormatPrompt();
    default:
      return [
        "🤖 ━━━━━━━━━━━━━━━━━━━━",
        "",
        "  <b>Q&A Mode</b>",
        "  <i>AI မေးမြန်းခြင်း</i>",
        "",
        "━━━━━━━━━━━━━━━━━━━━",
        "",
        "ပုံစံ (format) မလိုအပ်ပါ",
        "သိရှိလိုသည်များကို တိုက်ရိုက်မေးပါ",
        "",
        "━━━━━━━━━━━━━━━━━━━━",
      ].join("\n");
  }
}
export function getFormatHintFooter(mode: string): string {
  let fields = "";
  if (mode === 'demand_report') {
    fields = "Date • Customer Name • Phone • Product Name • Product Code • Quantity • Unit Price • Stage • Fulfillment Status • Note";
  } else if (mode === 'customer_service') {
    fields = "Date • Customer Name • Company • Phone • Email • Purchased Product • Purchase Amount MMK • Status • Next Follow Up • CSAT • Last Contact Note";
  } else if (mode === 'finance_transactions') {
    fields = "Date • Description • Category • Type • Amount (MMK) • Payment Method • Reference • Notes";
  } else if (mode === 'inventory_import') {
    fields = "Product Code • Product Name • Category • Unit Cost • Selling Price • Stock Qty • Low Stock Threshold";
  } else if (mode === 'marketing_import') {
    fields = "Date • Channel • Spend • Reach • Impressions • Ad-driven Orders • Notes";
  }
  return [
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    `💡 <i>${fields}</i>`,
  ].join("\n");
}
export function getCopyPasteTemplateForMode(mode: string | null | undefined): string {
  switch (mode) {
    case 'demand_report':
      return [
        "📈 ━━━━━━━━━━━━━━━━━━━━",
        "",
        "  <b>Sales Orders Template</b>",
        "",
        "━━━━━━━━━━━━━━━━━━━━",
        "",
        "Excel Row 1 အတွက် -",
        "<code>Date, Customer Name, Phone, Product Name, Product Code, Quantity, Unit Price, Stage, Fulfillment Status, Notes</code>",
        "",
        "စာသားကို ဖိနှိပ်၍ Copy ကူးယူပါ -",
        "",
        "<code>• Date: \n• Customer Name: \n• Phone: \n• Product Name: \n• Product Code: \n• Quantity: \n• Unit Price: \n• Note: </code>",
      ].join("\n");
    case 'customer_service':
      return [
        "🎧 ━━━━━━━━━━━━━━━━━━━━",
        "",
        "  <b>Customer Service Template</b>",
        "",
        "━━━━━━━━━━━━━━━━━━━━",
        "",
        "Excel Row 1 အတွက် -",
        "<code>Date, Customer Name, Company, Phone, Email, Purchased Product, Purchase Amount (MMK), Status, Next Follow Up, CSAT, Last Contact Note</code>",
        "",
        "စာသားပုံစံအတွက် ဖိနှိပ်၍ Copy ကူးယူပါ -",
        "<code>• Date: \n• Customer Name: \n• Company: \n• Phone: \n• Email: \n• Purchased Product: \n• Purchase Amount MMK: \n• Status: \n• Next Follow Up: \n• CSAT: \n• Last Contact Note: </code>",
      ].join("\n");
    case 'finance_transactions':
      return [
        "💳 ━━━━━━━━━━━━━━━━━━━━",
        "",
        "  <b>Finance Transactions Template</b>",
        "",
        "━━━━━━━━━━━━━━━━━━━━",
        "",
        "Excel Row 1 အတွက် -",
        "<code>Date, Description, Category, Type, Amount (MMK), Payment Method, Reference, Notes</code>",
        "",
        "စာသားကို ဖိနှိပ်၍ Copy ကူးယူပါ -",
        "",
        "<code>• Date: \n• Description: \n• Category: \n• Type: \n• Amount (MMK): \n• Payment Method: \n• Reference: \n• Notes: </code>",
      ].join("\n");
    case 'inventory_import':
      return [
        "📦 ━━━━━━━━━━━━━━━━━━━━",
        "",
        "  <b>Inventory / Products Template</b>",
        "",
        "━━━━━━━━━━━━━━━━━━━━",
        "",
        "Excel ရဲ့ ပထမဆုံး တစ်ကြောင်း (Row 1) မှာ ကူးထည့်ပါ -",
        "",
        "<code>Product Code, Product Name, Category, Unit Cost, Selling Price, Stock Qty, Low Stock Threshold</code>",
        "",
        "စာသားပုံစံအတွက် ဖိနှိပ်၍ Copy ကူးယူပါ -",
        "<code>• Product Code: \n• Product Name: \n• Category: \n• Unit Cost: \n• Selling Price: \n• Stock Qty: \n• Low Stock Threshold: </code>",
      ].join("\n");
    case 'marketing_import':
      return [
        "📣 ━━━━━━━━━━━━━━━━━━━━",
        "",
        "  <b>Marketing Metrics Template</b>",
        "",
        "━━━━━━━━━━━━━━━━━━━━",
        "",
        "Excel ရဲ့ ပထမဆုံး တစ်ကြောင်း (Row 1) မှာ ကူးထည့်ပါ -",
        "",
        "<code>Date, Channel, Spend, Reach, Impressions, Ad-driven Orders, Notes</code>",
        "",
        "စာသားပုံစံအတွက် ဖိနှိပ်၍ Copy ကူးယူပါ -",
        "<code>• Date: \n• Channel: \n• Spend: \n• Reach: \n• Impressions: \n• Ad-driven Orders: \n• Notes: </code>",
      ].join("\n");
    default:
      return [
        "🤖 ━━━━━━━━━━━━━━━━━━━━",
        "",
        "  <b>အဆင်သင့်မဖြစ်သေးပါ</b>",
        "",
        "━━━━━━━━━━━━━━━━━━━━",
        "",
        "Template ရယူရန် ဦးစွာ /menu မှ",
        "ကဏ္ဍတစ်ခုကို ရွေးချယ်ပေးပါ။",
      ].join("\n");
  }
}
export function escapeHtml(value: string | null | undefined): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
