import { POST } from "./route";

jest.mock("@/lib/pdf-generator", () => ({
  generatePdfFromHtml: jest.fn(async () => ({ base64: "ZmFrZQ==", filename: "x.pdf" })),
}));

jest.mock("@/lib/pdf/embed-noto-fonts-into-html", () => ({
  embedNotoSansIntoHtml: (html: string) => ({ embedded: true, html }),
}));

describe("POST /api/pdf/from-html", () => {
  it("zwraca 400 gdy brak html", async () => {
    const req = new Request("http://localhost:3000/api/pdf/from-html", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: "a.pdf" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("zwraca base64 i filename dla poprawnego html", async () => {
    const req = new Request("http://localhost:3000/api/pdf/from-html", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: "<p>ok</p>", filename: "a.pdf" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.filename).toBe("x.pdf");
    expect(json.base64).toBeTruthy();
  });
});

