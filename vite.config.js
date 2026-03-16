import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';
const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === 'true' && repoName.length > 0;

export default defineConfig({
  plugins: [svelte()],
  base: isGitHubPagesBuild ? `/${repoName}/` : '/',
});
