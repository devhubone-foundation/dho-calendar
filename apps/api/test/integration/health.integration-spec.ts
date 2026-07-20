import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { createTestApp } from "./test-app";

describe("Health (integration)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/health returns healthy without authentication", async () => {
    const response = await request(app.getHttpServer()).get("/api/health").expect(200);
    expect(response.body.status).toBe("ok");
    expect(typeof response.body.timestamp).toBe("string");
  });
});
