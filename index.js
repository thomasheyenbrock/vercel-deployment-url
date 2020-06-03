const core = require("@actions/core");
const fetch = require("node-fetch");

const DEPLOYMENT_SEARCH_INTERVAL = 5;
const DEPLOYMENT_READY_INTERVAL = 30;

async function wait(s) {
  return new Promise((resolve) => setTimeout(resolve, s * 1000));
}

async function main() {
  const vercelToken = core.getInput("vercel-token", { required: true });
  const projectId = core.getInput("project-id", { required: true });
  const teamId = core.getInput("team-id");
  const searchRetries = parseInt(core.getInput("search-retries"), 10) || 3;
  const readyRetries = parseInt(core.getInput("ready-retries"), 10) || 10;

  async function api(path) {
    const res = await fetch(`https://api.vercel.com${path}`, {
      headers: {
        authorization: `Bearer ${vercelToken}`,
      },
    });
    const json = await res.json();
    if (!res.ok) {
      console.error(json);
      throw new Error(
        "Something went wrong while trying to fetch deployments from the Vercel API, see the error above."
      );
    }
    return json;
  }

  async function findLatestDeployment(commitSha, retries) {
    if (typeof retries !== "number" || retries <= 0) {
      throw new Error(
        `Could not find any Vercel deployments for the commit with SHA ${commitSha}.`
      );
    }

    console.log("Searching for deployments related to this commit.");
    const { deployments } = await api(
      `/v5/now/deployments?${
        teamId ? `teamId=${teamId}&` : ""
      }projectId=${projectId}&meta-githubCommitSha=${commitSha}`
    );

    if (Array.isArray(deployments) && deployments.length > 0) {
      console.log(
        `Found ${deployments.length} deployment${
          deployments.length > 1 ? "s" : ""
        }, using the latest one.`
      );
      return api(
        `/v11/now/deployments/${deployments[0].uid}${
          teamId ? `?teamId=${teamId}&` : ""
        }`
      );
    }
    console.log(
      `No deployments found yet, waiting for ${DEPLOYMENT_SEARCH_INTERVAL} seconds before trying again (${retries} retries remaining)`
    );
    await wait(DEPLOYMENT_SEARCH_INTERVAL);
    return findLatestDeployment(commitSha, retries - 1);
  }

  async function waitForDeploymentToBeReady(deployment, retries) {
    if (typeof retries !== "number" || retries <= 0) {
      throw new Error(
        "The Vercel deployment is still not ready after running out of retries."
      );
    }
    switch (deployment.readyState) {
      case "READY":
        console.log(`The deployment is ready under ${deployment.url}.`);
        return deployment;
      case "ERROR":
        throw new Error("The Vercel deployment did not succeed.");
      case "QUEUED":
      case "BUILDING":
      default:
        console.log(
          `The latest deployment is still in the '${deployment.readyState}' state, waiting for ${DEPLOYMENT_READY_INTERVAL} more seconds (${retries} retries remaining)`
        );
        await wait(DEPLOYMENT_READY_INTERVAL);
        const updatedDeployment = await api(
          `/v11/now/deployments/${deployment.id}${
            teamId ? `?teamId=${teamId}&` : ""
          }`
        );
        return waitForDeploymentToBeReady(updatedDeployment, retries - 1);
    }
  }

  const commitSha = process.env.GITHUB_SHA;
  const deployment = await findLatestDeployment(commitSha, searchRetries);
  const readyDeployment = await waitForDeploymentToBeReady(
    deployment,
    readyRetries
  );
  core.setOutput("url", readyDeployment.url);
}

main().catch((error) => {
  core.setFailed(error.message);
});
