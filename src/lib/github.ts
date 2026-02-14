import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";
import { env } from "~/env";

let _app: App | null = null;

function getApp(): App {
  _app ??= new App({
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
    Octokit: Octokit,
  });
  return _app;
}


export async function getInstallationOctokit(installationId: string) {
  const app = getApp();
  return app.getInstallationOctokit(Number(installationId)) as Promise<InstanceType<typeof Octokit>>;
}
