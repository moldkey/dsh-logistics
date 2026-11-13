/**
 * dsh-logistics — 跨境物流选型与单证
 */

export const name = "dsh-logistics";
export const inject = ["tools"];

const NL = String.fromCharCode(10);
const SITE = "https://deepseekbase.com/zh/tools/";
const TEXT_OUTPUT = {
  schema: { type: "object", additionalProperties: false, properties: { text: { type: "string" } }, required: ["text"] },
  render: (_args, value) => [{ type: "text", text: (value && value.text) || "" }],
};

const MODES = {
  express: { name: "国际快递", days: "3–7 天", best: "小件/样品/急件", limit: "单件 ≤70kg，体积重计费" },
  air: { name: "空运", days: "5–10 天", best: "中高价值、200kg–2t", limit: "按计费重，需报关" },
  sea: { name: "海运（整柜/拼箱）", days: "25–40 天", best: "大货、低时效要求", limit: "起运量 1CBM 起，按方计费" },
  rail: { name: "中欧班列", days: "18–25 天", best: "欧洲内陆、比海运快", limit: "线路覆盖有限" },
};

function n(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }

const TOOLS = {
  logistics_mode: {
    description: "物流方式选择：按重量、体积、货值与时效推荐快递/空运/海运/铁路",
    parameters: {
      type: "object", additionalProperties: false,
      properties: {
        weight_kg: { type: "number", description: "总毛重 kg" },
        volume_cbm: { type: "number", description: "总体积 CBM" },
        value_usd: { type: "number", description: "货值 USD，可选" },
        urgent: { type: "boolean", description: "是否急件" },
        destination: { type: "string", description: "目的地，如 US / EU / SEA" },
      },
      required: ["weight_kg"],
    },
    run(args) {
      const w = n(args.weight_kg, 0);
      const v = n(args.volume_cbm, 0);
      const urgent = String(args.urgent || "") === "true";
      const dest = String(args.destination || "未填");
      const recs = [];
      if (urgent || w <= 70) recs.push(["express", "急件/小件优先"]);
      if (!urgent && w >= 100 && w <= 3000) recs.push(["air", "时效与成本平衡"]);
      if (w >= 500 || v >= 1) recs.push(["sea", "大货成本最低"]);
      if (String(dest).toUpperCase().indexOf("EU") >= 0 && !urgent) recs.push(["rail", "欧洲内陆可选中欧班列"]);
      if (!recs.length) recs.push(["air", "默认空运"]);
      const lines = ["物流方式推荐", "=".repeat(52), "毛重: " + w + " kg", "体积: " + v + " CBM", "目的地: " + dest, "急件: " + (urgent ? "是" : "否"), ""];
      recs.forEach((r) => {
        const m = MODES[r[0]];
        lines.push("- " + m.name + "：" + m.days + "，适合 " + m.best + "；" + r[1]);
      });
      lines.push("");
      lines.push("计费: 空运/快递按体积重（cm³/6000 或 5000）与实重取大；海运按 CBM 或整柜。");
      lines.push("时效与价格随航线、旺季、清关变化，以货代报价为准。");
      lines.push("");
      lines.push("更多工具：" + SITE);
      return lines.join(NL);
    },
  },
  logistics_docs: {
    description: "出口单证清单：按运输方式与贸易术语列出需要的单据",
    parameters: {
      type: "object", additionalProperties: false,
      properties: {
        mode: { type: "string", enum: ["express", "air", "sea", "rail"], description: "运输方式" },
        incoterm: { type: "string", description: "贸易术语，如 FOB / CIF / DDP（可选）" },
      },
      required: ["mode"],
    },
    run(args) {
      const mode = String(args.mode || "sea");
      const term = String(args.incoterm || "").toUpperCase();
      const base = ["商业发票 Commercial Invoice", "装箱单 Packing List", "报关单", "合同/订单"];
      const extra = {
        express: ["快递面单", "申报清单"],
        air: ["空运提单 AWB", "鉴定报告（带电/粉末）"],
        sea: ["海运提单 B/L", "订舱单 S/O", "VGM 申报"],
        rail: ["铁路运单 CIM/SMGS", "出口报关单"],
      }[mode] || [];
      const lines = ["出口单证清单 — " + mode + (term ? " / " + term : ""), "=".repeat(52)];
      base.concat(extra).forEach((x, i) => lines.push((i + 1) + ". " + x));
      if (term === "CIF" || term === "CIP") lines.push("+ 保险单（卖方投保）");
      if (term === "DDP") lines.push("+ 目的国清关税单与税号资料");
      lines.push("");
      lines.push("原产地证（CO/Form A 等）按目的国关税优惠要求另办。");
      lines.push("");
      lines.push("更多工具：" + SITE);
      return lines.join(NL);
    },
  },
};

export function apply(ctx, config) {
  void config;
  for (const name of Object.keys(TOOLS)) {
    const t = TOOLS[name];
    ctx.tools.register({
      name: name,
      description: t.description,
      parameters: t.parameters,
      output: TEXT_OUTPUT,
      async execute(args) { try { return { text: t.run(args || {}) }; } catch (e) { return { text: "处理失败: " + String((e && e.message) || e) }; } },
    });
  }
}
