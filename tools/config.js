const { argv } = require('yargs');
const firebaseTools = require('firebase-tools');
const inquirer = require('inquirer');
const fs = require('mz/fs');
const path = require('path');

// Command Line Arguments
const userToken = argv.token;
const projectId = argv.projectId;

Promise.resolve(userToken)
  // Log in to firebase-tools
  .then(async userToken => {
    if (userToken) return userToken;
    const {
      tokens: { refresh_token: freshToken }
    } = await firebaseTools.login.ci();
    return freshToken;
  })
  // Capture the firebase test project
  .then(async token => {
    const project = await (async () => {
      if (projectId) return projectId;

      const projects = await firebaseTools.list({ token });
      const response = await inquirer.prompt([
        {
          type: 'list',
          name: 'projectId',
          message: 'Which project would you like to use to test?',
          choices: projects.map(project => ({
            name: `${project.name} (${project.id})`,
            value: project
          }))
        }
      ]);

      const { projectId: { id } } = response;

      return id;
    })();

    // Write config to top-level config directory
    const writeConfig = firebaseTools.setup
      .web({ project, token })
      .then(config =>
        fs.writeFile(
          path.resolve(__dirname, '../config/project.json'),
          JSON.stringify(config, null, 2)
        )
      );

    // Deploy database rules
    const deployRules = firebaseTools.deploy({
      project,
      token,
      cwd: path.resolve(__dirname, '../config')
    });

    return Promise.all([writeConfig, deployRules]);
  })
  .then(() => {
    console.log('Success! Exiting...');
    process.exit();
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });