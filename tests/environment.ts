// Every test process talks to the test database and the test publishing key.
const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/starter_test";
if (!new URL(url).pathname.endsWith("_test")) throw new Error("Tests need a database whose name ends in _test.");
process.env.DATABASE_URL = url;
process.env.GOMNEE_PUBLISHING_TOKEN = "test-only-publishing-key-0000000000000000";
