import { describe, expect, it } from "@jest/globals";
import {
  buildDuplicateParticipantMessage,
  findDuplicateParticipantIdentities,
  isCompanyPlaceholderParticipant,
  participantIdentityKey,
} from "@/lib/participants/duplicate-identity";

describe("participantIdentityKey", () => {
  it("normalizuje wielkość liter i spacje", () => {
    expect(participantIdentityKey("  Jan  ", "KOWALSKI", "1990-01-01")).toBe(
      participantIdentityKey("jan", "kowalski", "1990-01-01"),
    );
  });
});

describe("isCompanyPlaceholderParticipant", () => {
  it("wykrywa placeholdery firmowe", () => {
    expect(
      isCompanyPlaceholderParticipant({
        first_name: "Uczestnik 1",
        last_name: "(dane do uzupełnienia)",
        birth_date: "1900-01-01",
      }),
    ).toBe(true);
  });

  it("nie traktuje normalnego uczestnika jako placeholdera", () => {
    expect(
      isCompanyPlaceholderParticipant({
        first_name: "Jan",
        last_name: "Kowalski",
        birth_date: "1990-01-01",
      }),
    ).toBe(false);
  });
});

describe("findDuplicateParticipantIdentities", () => {
  it("wykrywa duplikat względem już zapisanych uczestników", () => {
    const duplicates = findDuplicateParticipantIdentities(
      [{ first_name: "Anna", last_name: "Nowak", birth_date: "2012-05-15" }],
      [{ first_name: "anna", last_name: "nowak", birth_date: "2012-05-15", is_active: true }],
    );
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].first_name).toBe("Anna");
  });

  it("wykrywa duplikat wewnątrz jednej rezerwacji", () => {
    const duplicates = findDuplicateParticipantIdentities(
      [
        { first_name: "Jan", last_name: "Kowalski", birth_date: "1990-01-01" },
        { first_name: "Jan", last_name: "Kowalski", birth_date: "1990-01-01" },
      ],
      [],
    );
    expect(duplicates).toHaveLength(1);
  });

  it("ignoruje nieaktywnych uczestników", () => {
    const duplicates = findDuplicateParticipantIdentities(
      [{ first_name: "Anna", last_name: "Nowak", birth_date: "2012-05-15" }],
      [{ first_name: "Anna", last_name: "Nowak", birth_date: "2012-05-15", is_active: false }],
    );
    expect(duplicates).toHaveLength(0);
  });

  it("ignoruje placeholdery firmowe", () => {
    const duplicates = findDuplicateParticipantIdentities(
      [
        {
          first_name: "Uczestnik 1",
          last_name: "(dane do uzupełnienia)",
          birth_date: "1900-01-01",
        },
      ],
      [
        {
          first_name: "Uczestnik 1",
          last_name: "(dane do uzupełnienia)",
          birth_date: "1900-01-01",
          is_active: true,
        },
      ],
    );
    expect(duplicates).toHaveLength(0);
  });

  it("nie blokuje tego samego zamawiającego zapisującego inną osobę", () => {
    const duplicates = findDuplicateParticipantIdentities(
      [{ first_name: "Piotr", last_name: "Nowak", birth_date: "2014-02-02" }],
      [{ first_name: "Anna", last_name: "Nowak", birth_date: "2012-05-15", is_active: true }],
    );
    expect(duplicates).toHaveLength(0);
  });
});

describe("buildDuplicateParticipantMessage", () => {
  it("buduje komunikat dla jednej osoby", () => {
    const message = buildDuplicateParticipantMessage([
      { first_name: "Anna", last_name: "Nowak", birth_date: "2012-05-15" },
    ]);
    expect(message).toContain("Anna Nowak");
    expect(message).toContain("15.05.2012");
    expect(message).toContain("już zapisany");
  });
});
