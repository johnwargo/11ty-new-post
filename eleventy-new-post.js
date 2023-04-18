#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import boxen from 'boxen';
import prompts from 'prompts';
import YAML from 'yaml';
import logger from 'cli-logger';
var log = logger();
const APP_NAME = 'Eleventy Category Files Generator';
const APP_AUTHOR = 'by John M. Wargo (https://johnwargo.com)';
const APP_CONFIG_FILE = '11ty-np.json';
const ELEVENTY_FILES = ['.eleventy.js', 'eleventy.config.js'];
const TEMPLATE_FILE = '11ty-np.md';
const UNCATEGORIZED_STRING = 'Uncategorized';
const YAML_PATTERN = /(?<=---[\r\n]).*?(?=[\r\n]---)/s;
var fileList = [];
var templateExtension;
function checkEleventyProject() {
    log.info('Validating project folder');
    let result = false;
    ELEVENTY_FILES.forEach((file) => {
        let tmpFile = path.join(process.cwd(), file);
        if (fs.existsSync(tmpFile)) {
            result = true;
        }
    });
    return result;
}
function compareFunction(a, b) {
    if (a.title < b.title) {
        return -1;
    }
    if (a.title > b.title) {
        return 1;
    }
    return 0;
}
async function validateConfig(validations) {
    var processResult;
    processResult = {
        result: true, message: 'Configuration file errors:\n'
    };
    for (var validation of validations) {
        log.debug(`Validating '${validation.filePath}'`);
        if (validation.isFolder) {
            if (!directoryExists(validation.filePath)) {
                processResult.result = false;
                processResult.message += `\nThe '${validation.filePath}' folder is required, but does not exist.`;
            }
        }
        else {
            if (!fs.existsSync(validation.filePath)) {
                processResult.result = false;
                processResult.message += `\nThe '${validation.filePath}' file is required, but does not exist.`;
            }
        }
    }
    return processResult;
}
function getAllFiles(dirPath, arrayOfFiles) {
    var files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];
    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        }
        else {
            arrayOfFiles.push(path.join(process.cwd(), dirPath, file));
        }
    });
    return arrayOfFiles;
}
function getFileList(filePath, debugMode) {
    if (debugMode)
        console.log();
    log.debug('Building file list...');
    log.debug(`filePath: ${filePath}`);
    return getAllFiles(filePath, []);
}
function buildCategoryList(fileList, debugMode) {
    if (debugMode)
        console.log();
    log.debug('Building category list...');
    let categories = [];
    for (var fileName of fileList) {
        log.debug(`Parsing ${fileName}`);
        if (path.extname(fileName.toString().toLocaleLowerCase()) !== '.json') {
            var postFile = fs.readFileSync(fileName.toString(), 'utf8');
            var YAMLDoc = YAML.parseAllDocuments(postFile, { logLevel: 'silent' });
            var content = YAMLDoc[0].toJSON();
            if (content.categories) {
                var categoriesString = content.categories.toString();
            }
            else {
                categoriesString = UNCATEGORIZED_STRING;
            }
            var catArray = categoriesString.split(',');
            for (var cat of catArray) {
                var category = cat.trim();
                var index = categories.findIndex((item) => item.title === category);
                if (index < 0) {
                    log.debug(`Found category: ${category}`);
                    if (category === UNCATEGORIZED_STRING) {
                        categories.push({ title: category, value: '' });
                    }
                    else {
                        categories.push({ title: category, value: category });
                    }
                }
            }
        }
        else {
            log.debug(`Skipping ${fileName}`);
        }
    }
    if (!categories.some(code => code.title === UNCATEGORIZED_STRING)) {
        categories.push({ title: UNCATEGORIZED_STRING, value: '' });
    }
    return categories;
}
function directoryExists(filePath) {
    if (fs.existsSync(filePath)) {
        try {
            return fs.lstatSync(filePath).isDirectory();
        }
        catch (err) {
            log.error(`checkDirectory error: ${err}`);
            return false;
        }
    }
    return false;
}
function findFilePath(endPath, thePaths) {
    let resStr = path.join(thePaths[thePaths.length - 1], endPath);
    for (var tmpPath of thePaths) {
        let destPath = path.join(tmpPath, endPath);
        log.debug(`Checking ${destPath}`);
        if (directoryExists(destPath)) {
            resStr = destPath;
            break;
        }
    }
    return resStr;
}
function buildConfigObject() {
    const theFolders = ['.', 'src'];
    return {
        postsFolder: findFilePath('posts', theFolders),
        templateFile: TEMPLATE_FILE,
        useYear: false
    };
}
console.log(boxen(APP_NAME, { padding: 1 }));
console.log('\n' + APP_AUTHOR);
const myArgs = process.argv.slice(2);
const debugMode = myArgs.includes('-d');
const doPopulate = myArgs.includes('-p');
log.level(debugMode ? log.DEBUG : log.INFO);
log.debug('Debug mode enabled\n');
log.debug(`cwd: ${process.cwd()}`);
if (!checkEleventyProject()) {
    log.error('Current folder is not an Eleventy project folder.');
    process.exit(1);
}
log.debug('Project is an Eleventy project folder');
const configFile = path.join(process.cwd(), APP_CONFIG_FILE);
log.info('Locating configuration file');
if (!fs.existsSync(configFile)) {
    log.info(`\nConfiguration file '${APP_CONFIG_FILE}' not found`);
    log.info('Rather than using a bunch of command-line arguments, this tool uses a configuration file instead.');
    log.info('In the next step, the module will automatically create the configuration file for you.');
    log.info('Once it completes, you can edit the configuration file to change the default values and execute the command again.');
    console.log();
    let response = await prompts({
        type: 'confirm',
        name: 'continue',
        message: 'Create configuration file?',
        initial: true
    });
    if (response.continue) {
        let configObject = buildConfigObject();
        if (debugMode)
            console.dir(configObject);
        let outputStr = JSON.stringify(configObject, null, 2);
        outputStr = outputStr.replace(/\\/g, '/');
        outputStr = outputStr.replaceAll('//', '/');
        log.info(`Writing configuration file ${APP_CONFIG_FILE}`);
        try {
            fs.writeFileSync(path.join('.', APP_CONFIG_FILE), outputStr, 'utf8');
            log.info('Output file written successfully');
            log.info('\nEdit the configuration with the correct values for this project then execute the command again.');
        }
        catch (err) {
            log.error(`Unable to write to ${APP_CONFIG_FILE}`);
            console.dir(err);
            process.exit(1);
        }
        process.exit(0);
    }
    else {
        log.info('Exiting...');
        process.exit(0);
    }
}
log.info('Configuration file located, validating');
const configFilePath = path.join(process.cwd(), APP_CONFIG_FILE);
if (!fs.existsSync(configFilePath)) {
    log.error(`Unable to locate the configuration file '${APP_CONFIG_FILE}'`);
    process.exit(1);
}
let configData = fs.readFileSync(configFilePath, 'utf8');
const configObject = JSON.parse(configData);
const validations = [
    { filePath: configObject.postsFolder, isFolder: true },
    { filePath: configObject.templateFile, isFolder: false }
];
validateConfig(validations)
    .then(async (res) => {
    if (res.result) {
        templateExtension = path.extname(configObject.templateFile);
        log.info(`Reading template file ${configObject.templateFile}`);
        const templateFile = fs.readFileSync(configObject.templateFile, 'utf8');
        let templateDoc = YAML.parseAllDocuments(templateFile, { logLevel: 'silent' });
        let templateFrontmatter = JSON.parse(JSON.stringify(templateDoc))[0];
        if (debugMode)
            console.dir(templateFrontmatter);
        if (!templateFrontmatter) {
            log.error('The template file does not contain any YAML front matter, exiting');
            process.exit(1);
        }
        fileList = getFileList(configObject.postsFolder, debugMode);
        if (fileList.length < 1) {
            log.error('\nNo Post files found in the project, exiting');
            process.exit(0);
        }
        log.debug(`Located ${fileList.length} post files`);
        if (debugMode)
            console.dir(fileList);
        let categories = buildCategoryList(fileList, debugMode);
        if (categories.length > 0)
            log.info(`Found ${categories.length} categories`);
        categories = categories.sort(compareFunction);
        if (debugMode)
            console.table(categories);
        const questions = [
            {
                type: 'text',
                name: 'postTitle',
                message: 'Enter a title for the post:'
            }, {
                type: 'select',
                name: 'postCategory',
                message: 'Select an article category from the list:',
                choices: categories,
                initial: 0
            }
        ];
        console.log();
        let response = await prompts(questions);
        let postTitle = response.postTitle;
        log.debug(`Title: ${postTitle}`);
        let postCategory = response.postCategory;
        log.debug(`Selected category: ${postCategory}`);
        templateFrontmatter.title = postTitle;
        templateFrontmatter.category = postCategory;
        let newFile = templateFile.slice();
        console.log(newFile);
        let tmpFrontmatter = YAML.stringify(templateFrontmatter, { logLevel: 'silent' });
        tmpFrontmatter = tmpFrontmatter.replace(/\n$/, '');
        newFile = newFile.replace(YAML_PATTERN, tmpFrontmatter);
        if (doPopulate) {
            newFile += 'this is some extra text';
        }
        let outputFile = path.join(process.cwd(), configObject.postsFolder);
        if (configObject.useYear) {
            outputFile = path.join(outputFile, new Date().getFullYear().toString());
        }
        outputFile = path.join(outputFile, postTitle.toLowerCase().replaceAll(' ', '-') + templateExtension);
        log.info(`Writing changes to ${outputFile}`);
        fs.writeFileSync(outputFile, newFile, 'utf8');
    }
    else {
        log.error(res.message);
        process.exit(1);
    }
})
    .catch((err) => {
    log.error(err);
    process.exit(1);
});
