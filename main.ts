const { Octokit } = require("@octokit/core");
const fs = require('fs-extra')
const shell = require('shelljs');
const promptC = require('prompt');
const colors = require("colors/safe");
require('dotenv').config();

const octokit = new Octokit({ auth: process.env.TOKEN });
let targetVersion:string;
let previousVersion:string;

promptInputData();

function promptInputData() {
  promptC.message = '';
  promptC.delimiter = '';

  const properties = [
    {
      name: 'target_version',
      description: colors.white("Target version: "),
      validator: /^\d+(\.\d+)(\.\d+)$/,
      warning: 'Target version must meet this pattern ^\d+(\.\d+)(\.\d+)$'
    },
    {
      name: 'previous_version',
      description: colors.white("Previous version: "),
      validator: /^\d+(\.\d+)(\.\d+)$/,
      warning: 'Previous version must meet this pattern ^\d+(\.\d+)(\.\d+)$'
    }
  ];

  promptC.start();

  promptC.get(properties, function (err, result) {
    if (err) {
      return onErr(err);
    }

    targetVersion = result.target_version;
    previousVersion = result.previous_version;
    init();
  });

  function onErr(err) {
    console.log(err);
    return 1;
  }
}

async function init () {
  const masterBasedPrList = await retrievePrList();
  retrieveReleaseNotes(masterBasedPrList);
}

async function retrievePrList() {
  try {
    const masterBasedPrListRawResponse = await retrieveGithubApiData({
      baseUrl: 'GET /repos/{owner}/{repo}/pulls',
      owner: 'okode',
      repo: 'mets',
      state: 'all',
      base: 'master',
      per_page: 100
    })
    const masterBasedPrListRawResponseData = masterBasedPrListRawResponse?.data;
    return masterBasedPrListRawResponseData.filter(el => el?.merged_at).map(el => el?.number)
  } catch (error) {
    console.log(error)
  }
}


async function retrieveReleaseNotes(masterBasedPrList: number[]) {
  debugger;
  try {
    const releaseNotesRawResponse = await retrieveGithubApiData({
      baseUrl: 'POST /repos/{owner}/{repo}/releases/generate-notes',
      owner: 'okode',
      repo: 'mets',
      tag_name: targetVersion.toString(),
      previous_tag_name: previousVersion.toString()
    })
    const releaseNotesRawData = releaseNotesRawResponse.data.body;

    const masterBasedReleaseNotes = releaseNotesRawData.split('\n')
    .filter(el => el.startsWith('* '))
    .map(el => ({title: el, prNumber: el.substring(el.length - 4)}))
    .filter(el => masterBasedPrList.includes(Number(el?.prNumber)));

    const masterBasedReleaseNotesTitles = masterBasedReleaseNotes.map(el => el.title);

    writeToFile({file: `./releases/${targetVersion}.txt`, content: masterBasedReleaseNotesTitles });

  } catch (error) {
    console.log(error);
  }
}

function writeToFile({file, content}: {file: string, content: any}) {
  fs.outputFile(file, JSON.stringify(content, null, 2))
  .then(_ => {
    shell.exec(`code ./releases/${targetVersion}.txt`)  
  })
  .catch(err => {
    console.error(err)
  })
}

async function retrieveGithubApiData({
  baseUrl, 
  owner, 
  repo, 
  state, 
  base,
  tag_name, 
  previous_tag_name, 
  per_page
}: {
  baseUrl: string,
  owner: string, 
  repo: string, 
  state?: string, 
  base?: string,
  tag_name?: string, 
  previous_tag_name?: string, 
  per_page?: number
}) {
  const pullRequestListRawResponse = await octokit.request(baseUrl, {
    owner,
    repo,
    state,
    base,
    tag_name,
    previous_tag_name,
    per_page
  })
  return pullRequestListRawResponse;
}