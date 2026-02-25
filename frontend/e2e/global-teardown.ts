import { composeDown } from "./helpers/docker-compose"

export default async function globalTeardown() {
    composeDown()
}
