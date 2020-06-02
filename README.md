# Vercel deployment URLs

This repository contains a GitHub action that uses the Vercel API to find the latest deployment for the current commit. It waits for the deployment to be done and then outputs the URL.

## Inputs

### `vercel-token`

**Required** A token to authenticate requests sent to the Vercel API. You can create one [here](https://vercel.com/account/tokens).

### `project-id`

**Required** The id of your Vercel project. Usually you can find it in the `.vercel/project.json` file inside your repository.

### `team-id`

If your Vercel project is owned by a team, you have to input the id of the team. It can also be found in the `.vercel/project.json` file. If you use the action for a personal Vercel project, don't use this input.

### `search-retries`

The number of retries if no deployment can be found for the current commit. There is a 5 second interval between tries. The default is `3`.

### `ready-retries`

The number of retries if the latest deployment found is not ready yet. There is a 30 second interval between tries. The default is `10`.

## Outputs

### `url`

The URL of the Vercel preview deployment in a `READY` state.

## Example usage

```yml
- name: Get deployment URL
  id: deployment
  uses: thomasheyenbrock/vercel-deployment-url@v1
  with:
    vercel-token: ${{ secrets.VERCEL_TOKEN }}
    project-id: ${{ secrets.VERCEL_PROjECT_ID }}
```

## Notes

- The action automatically uses the commit SHA that it runs on to find related Vercel deployments (using [deployment metadata](https://vercel.com/blog/deployment-metadata)). If there are multiple deployments for a single SHA the latest one is taken.
- This action will fail if...
  - ...it can't find any Vercel deployment related to the current commit after the specified number of retries.
  - ...the latest Vercel deployment for the current commit is not ready after the specified number of retries.
  - ...the Vercel deployment fails.
