import {
  buildOwuDocumentsMap,
  listResolvedOwuDocuments,
} from "@/lib/insurance-local/owu-resolve";

describe("buildOwuDocumentsMap", () => {
  it("używa dokumentu wycieczki zamiast globalnego", () => {
    const map = buildOwuDocumentsMap({
      tripDocs: [
        {
          insurance_type: 2,
          file_name: "trip/type-2.pdf",
          display_name: "Trip OWU",
        },
      ],
      globalDocs: [
        {
          insurance_type: 2,
          file_name: "global/type-2.pdf",
          display_name: "Global OWU",
        },
      ],
    });

    expect(map.get(2)).toEqual({
      insurance_type: 2,
      file_name: "trip/type-2.pdf",
      display_name: "Trip OWU",
      source: "trip",
    });
  });

  it("fallbackuje do globalnego gdy brak dokumentu wycieczki", () => {
    const map = buildOwuDocumentsMap({
      tripDocs: [],
      globalDocs: [
        {
          insurance_type: 1,
          file_name: "global/type-1.pdf",
          display_name: "Global OWU 1",
        },
      ],
    });

    expect(map.get(1)?.source).toBe("global");
    expect(map.get(1)?.file_name).toBe("global/type-1.pdf");
  });

  it("zwraca listę tylko dla typów z dokumentem", () => {
    const map = buildOwuDocumentsMap({
      tripDocs: [],
      globalDocs: [
        {
          insurance_type: 3,
          file_name: "global/type-3.pdf",
          display_name: null,
        },
      ],
    });

    const list = listResolvedOwuDocuments(map);
    expect(list).toHaveLength(1);
    expect(list[0].insurance_type).toBe(3);
  });
});
