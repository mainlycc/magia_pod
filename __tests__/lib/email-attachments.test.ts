import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { getTripDocumentationEmailAttachments } from "@/lib/documents/email-attachments";

type QueryResult = { data: unknown; error: unknown };

function createChainableQuery(result: QueryResult) {
  const chain: Record<string, jest.Mock> = {};
  const terminal = jest.fn(async () => result);
  const passthrough = () => chain;

  chain.select = jest.fn(passthrough);
  chain.eq = jest.fn(passthrough);
  chain.then = (onFulfilled: (v: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) =>
    terminal().then(onFulfilled, onRejected);

  // Allow awaiting the chain directly (supabase query builder is thenable)
  Object.assign(chain, {
    [Symbol.toStringTag]: "Promise",
  });

  // Make the object awaitable
  (chain as unknown as PromiseLike<QueryResult>).then = (
    onFulfilled?: ((value: QueryResult) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ) => terminal().then(onFulfilled as never, onRejected as never);

  return chain;
}

describe("getTripDocumentationEmailAttachments", () => {
  const downloads = new Map<string, { ok: boolean; content?: string }>();

  function createAdminClientMock(opts: {
    tripDocs?: Array<{ document_type: string; file_name: string; display_name: string | null }>;
    globalDocs?: Array<{ document_type: string; file_name: string; display_name: string | null }>;
    emailSettings?: Array<{ document_type: string; attach_on_reservation: boolean }>;
  }) {
    return {
      from: jest.fn((table: string) => {
        if (table === "trip_documents") {
          return createChainableQuery({ data: opts.tripDocs ?? [], error: null });
        }
        if (table === "global_documents") {
          return createChainableQuery({ data: opts.globalDocs ?? [], error: null });
        }
        if (table === "trip_document_email_settings") {
          return createChainableQuery({ data: opts.emailSettings ?? [], error: null });
        }
        return createChainableQuery({ data: [], error: null });
      }),
      storage: {
        from: jest.fn(() => ({
          download: jest.fn(async (fileName: string) => {
            const entry = downloads.get(fileName);
            if (!entry?.ok) {
              return { data: null, error: { message: "not found" } };
            }
            return {
              data: {
                arrayBuffer: async () => Buffer.from(entry.content ?? "pdf", "utf8"),
              },
              error: null,
            };
          }),
        })),
      },
    };
  }

  beforeEach(() => {
    downloads.clear();
  });

  it("dołącza tylko dokumenty z włączonym attach_on_reservation", async () => {
    downloads.set("trips/t1/agreement.pdf", { ok: true, content: "agreement" });
    downloads.set("trips/t1/rodo.pdf", { ok: true, content: "rodo" });

    const adminClient = createAdminClientMock({
      tripDocs: [
        { document_type: "agreement", file_name: "trips/t1/agreement.pdf", display_name: "Program" },
        { document_type: "rodo_info", file_name: "trips/t1/rodo.pdf", display_name: "RODO" },
      ],
      emailSettings: [
        { document_type: "agreement", attach_on_reservation: true },
        { document_type: "rodo_info", attach_on_reservation: false },
      ],
    });

    const attachments = await getTripDocumentationEmailAttachments({
      tripId: "t1",
      adminClient: adminClient as never,
    });

    expect(attachments.map((a) => a.filename)).toEqual(["Program.pdf"]);
  });

  it("gdy brak ustawienia — domyślnie dołącza dokument", async () => {
    downloads.set("global/standard_form.pdf", { ok: true, content: "form" });

    const adminClient = createAdminClientMock({
      globalDocs: [
        {
          document_type: "standard_form",
          file_name: "global/standard_form.pdf",
          display_name: "Formularz",
        },
      ],
      emailSettings: [],
    });

    const attachments = await getTripDocumentationEmailAttachments({
      tripId: "t1",
      adminClient: adminClient as never,
    });

    expect(attachments).toHaveLength(1);
    expect(attachments[0].filename).toBe("Formularz.pdf");
  });

  it("preferuje dokument trip nad globalnym (nowy upload)", async () => {
    downloads.set("trips/t1/agreement-new.pdf", { ok: true, content: "new" });
    downloads.set("global/agreement-old.pdf", { ok: true, content: "old" });

    const adminClient = createAdminClientMock({
      tripDocs: [
        {
          document_type: "agreement",
          file_name: "trips/t1/agreement-new.pdf",
          display_name: "Program NOWY",
        },
      ],
      globalDocs: [
        {
          document_type: "agreement",
          file_name: "global/agreement-old.pdf",
          display_name: "Program STARY",
        },
      ],
      emailSettings: [{ document_type: "agreement", attach_on_reservation: true }],
    });

    const attachments = await getTripDocumentationEmailAttachments({
      tripId: "t1",
      adminClient: adminClient as never,
    });

    expect(attachments).toHaveLength(1);
    expect(attachments[0].filename).toBe("Program NOWY.pdf");
    expect(Buffer.from(attachments[0].base64, "base64").toString("utf8")).toBe("new");
  });

  it("pomija dokumenty bez pliku oraz te z wyłączoną wysyłką", async () => {
    downloads.set("trips/t1/conditions.pdf", { ok: true, content: "cond" });

    const adminClient = createAdminClientMock({
      tripDocs: [
        {
          document_type: "conditions_de_pl",
          file_name: "trips/t1/conditions.pdf",
          display_name: "Warunki",
        },
        {
          document_type: "electronic_services",
          file_name: "",
          display_name: "Regulamin",
        },
      ],
      emailSettings: [
        { document_type: "conditions_de_pl", attach_on_reservation: false },
        { document_type: "electronic_services", attach_on_reservation: true },
      ],
    });

    const attachments = await getTripDocumentationEmailAttachments({
      tripId: "t1",
      adminClient: adminClient as never,
    });

    expect(attachments).toEqual([]);
  });

  it("nie dołącza legacy typów spoza zakładki Dokumentacja (rodo/terms/conditions)", async () => {
    downloads.set("global/rodo.pdf", { ok: true, content: "legacy-rodo" });
    downloads.set("global/terms.pdf", { ok: true, content: "legacy-terms" });
    downloads.set("global/conditions.pdf", { ok: true, content: "legacy-conditions" });
    downloads.set("global/rodo_info.pdf", { ok: true, content: "rodo-info" });

    const adminClient = createAdminClientMock({
      globalDocs: [
        { document_type: "rodo", file_name: "global/rodo.pdf", display_name: "RODO" },
        { document_type: "terms", file_name: "global/terms.pdf", display_name: "Regulamin" },
        {
          document_type: "conditions",
          file_name: "global/conditions.pdf",
          display_name: "Warunki udziału",
        },
        {
          document_type: "rodo_info",
          file_name: "global/rodo_info.pdf",
          display_name: "Informacja RODO",
        },
      ],
      emailSettings: [],
    });

    const attachments = await getTripDocumentationEmailAttachments({
      tripId: "t1",
      adminClient: adminClient as never,
    });

    expect(attachments.map((a) => a.filename)).toEqual(["Informacja RODO.pdf"]);
  });
});
