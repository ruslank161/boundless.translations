#!/usr/bin/env node
const _ = require('lodash');
const fs = require('fs');
const path = require('path');

const BASE_TRANSLATION_NAME = 'english';

const ROOT_DIR = path.resolve(__dirname, '..');
const TRANSLATIONS_DIR = path.join(ROOT_DIR, 'translations');

// Main

const BASE_TRANSLATION = loadTranslation(BASE_TRANSLATION_NAME);
const BASE_SCHEMA = inferSchema(BASE_TRANSLATION);

let invalid = false;
findTranslationNames().forEach(translationName => {
  if (translationName === BASE_TRANSLATION_NAME) return;
  invalid = validate(BASE_SCHEMA, loadTranslation(translationName), translationName) || invalid;
});
if (invalid) {
  die(`Failed validation checks`);
}

// Helpers

/**
 * @param {{[key: string]: 'string'|'string[]'}} schema
 * @param {{[key: string]: string|string[]}} translation
 * @param {string} translationName
 * @return {boolean}
 */
function validate(schema, translation, translationName) {
  const schemaKeys = _.keys(schema);
  const translationKeys = _.keys(translation);

  const missingKeys = _.without(schemaKeys, ...translationKeys);
  const extraKeys = _.without(translationKeys, ...schemaKeys);
  let invalid = false;

  if (!_.isEmpty(missingKeys)) {
    invalid = true;
    console.log(`The following keys are missing in ${translationName}:`);
    console.log();
    missingKeys.forEach(key => console.log(`  ${key}`));
    console.log();
  }

  if (!_.isEmpty(extraKeys)) {
    invalid = true;
    console.log(`The following keys are defined in ${translationName}, but are not known in ${BASE_TRANSLATION_NAME}:`);
    console.log();
    extraKeys.forEach(key => console.log(`  ${key}`));
    console.log();
  }

  const wrongTypes = {};
  const wrongLengths = {};
  _.each(schema, (schemaType, key) => {
    if (!(key in translation)) return; // Missing values handled above.
    const value = translation[key];
    const translationType = typeOfValue(value);
    if (schemaType !== translationType) {
      wrongTypes[key] = [translationType, schemaType];
    } else if (schemaType.endsWith('[]') && BASE_TRANSLATION[key].length !== value.length) {
      wrongLengths[key] = [value.length, BASE_TRANSLATION[key].length];
    }
  });

  if (!_.isEmpty(wrongTypes)) {
    invalid = true;
    console.log(`The following keys in ${translationName} are not the correct type:`);
    console.log();
    _.each(wrongTypes, ([translationType, schemaType], key) => {
      console.log(`  ${key} should be ${schemaType} but instead was ${translationType}`);
    });
    console.log();
  }

  if (!_.isEmpty(wrongLengths)) {
    invalid = true;
    console.log(`The following keys in ${translationName} have the wrong number of entries:`);
    console.log();
    _.each(wrongLengths, ([translationLength, schemaLength], key) => {
      console.log(`  ${key} should have ${schemaLength} entries, but instead has ${translationLength}`);
    });
    console.log();
  }

  return invalid;
}

/**
 * @return {string[]} Translation names, without .json.
 */
function findTranslationNames() {
  return fs.readdirSync(TRANSLATIONS_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => file.substr(0, file.length - 5));
}

/**
 * @param {string} name
 * @return {{[key: string]: string|string[]}} The parsed translation file.
 */
function loadTranslation(name) {
  const translationPath = path.join(TRANSLATIONS_DIR, `${name}.json`);
  let rawTranslations;
  try {
    rawTranslations = fs.readFileSync(translationPath);
  } catch (error) {
    die(`Unable to read ${translationPath}:`, error);
  }

  try {
    return JSON.parse(rawTranslations);
  } catch (error) {
    die(`Unable to parse ${translationPath} as JSON:`, error);
  }
}

/**
 * @param {{[key: string]: string|string[]}} translation
 * @return {{[key: string]: 'string'|'string[]'}} The type of each key in
 *   `translation`.
 */
function inferSchema(translation) {
  return _.mapValues(translation, typeOfValue);
}

/**
 * @param {any} value
 * @param {string} key
 */
function typeOfValue(value, key) {
  if (typeof value === 'string') {
    return 'string';
  } else if (Array.isArray(value)) {
    return 'string[]';
  } else {
    die(`Unknown translation type: ${key} is not a string or an array of strings:`, value);
  }
}

/**
 * @param {any[]} message
 * @return {never}
 */
function die(...message) {
  console.error(...message);
  process.exit(1);
}
