import { z } from "zod";

import { AppError } from "../errors/app-error";
import { ZodValidationPipe } from "./zod-validation.pipe";

const schema = z.object({ email: z.string().email(), age: z.number().min(0) });

describe("ZodValidationPipe", () => {
  it("returns the parsed value when valid", () => {
    const pipe = new ZodValidationPipe(schema);
    expect(pipe.transform({ email: "a@b.com", age: 5 })).toEqual({ email: "a@b.com", age: 5 });
  });

  it("throws an AppError with VALIDATION_ERROR and per-field messages when invalid", () => {
    const pipe = new ZodValidationPipe(schema);
    try {
      pipe.transform({ email: "not-an-email", age: -1 });
      throw new Error("expected pipe.transform to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const response = (error as AppError).getResponse() as {
        code: string;
        fieldErrors: Record<string, string[]>;
      };
      expect(response.code).toBe("VALIDATION_ERROR");
      expect(Object.keys(response.fieldErrors)).toEqual(expect.arrayContaining(["email", "age"]));
    }
  });
});
