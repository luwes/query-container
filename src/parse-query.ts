/** Adapted from https://github.com/GoogleChromeLabs/container-query-polyfill */

/**
 * Copyright 2021 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const enum Comparator {
  LESS_THAN,
  LESS_OR_EQUAL,
  GREATER_THAN,
  GREATER_OR_EQUAL,
}

interface SizeQuery {
  type: ContainerConditionType.SizeQuery;
  feature: string;
  comparator: Comparator;
  threshold: number;
}

interface ContainerConditionConjunction {
  type: ContainerConditionType.ContainerConditionConjunction;
  left: ContainerCondition;
  right: ContainerCondition;
}

interface ContainerConditionDisjunction {
  type: ContainerConditionType.ContainerConditionDisjunction;
  left: ContainerCondition;
  right: ContainerCondition;
}

interface ContainerConditionNegation {
  type: ContainerConditionType.ContainerConditionNegation;
  right: ContainerCondition;
}

enum ContainerConditionType {
  SizeQuery,
  ContainerConditionConjunction,
  ContainerConditionDisjunction,
  ContainerConditionNegation,
}

type ContainerCondition =
  | SizeQuery
  | ContainerConditionConjunction
  | ContainerConditionDisjunction
  | ContainerConditionNegation;

interface ContainerQueryDescriptor {
  name?: string;
  condition: ContainerCondition;
}

interface AdhocParser {
  sheetSrc: string;
  index: number;
  name?: string;
}

interface ParseResult {
  query: ContainerQueryDescriptor;
  startIndex: number;
  endIndex: number;
}

interface ResizeObserverSize {
  inlineSize: number;
  blockSize: number;
}

function translateToLogicalProp(feature: string): string {
  switch (feature.toLowerCase()) {
    case 'inlinesize':
      return 'inlineSize';
    case 'blocksize':
      return 'blockSize';
    case 'width':
      return 'inlineSize';
    case 'height':
      return 'blockSize';
    default:
      throw Error(`Unknown feature name ${feature} in container query`);
  }
}

function isSizeQueryFulfilled(
  condition: SizeQuery,
  borderBox: ResizeObserverSize
): boolean {
  const value = borderBox[translateToLogicalProp(condition.feature)];
  switch (condition.comparator) {
    case Comparator.GREATER_OR_EQUAL:
      return value >= condition.threshold;
    case Comparator.GREATER_THAN:
      return value > condition.threshold;
    case Comparator.LESS_OR_EQUAL:
      return value <= condition.threshold;
    case Comparator.LESS_THAN:
      return value < condition.threshold;
  }
}

export function isQueryFullfilled(
  condition: ContainerCondition,
  borderBox: ResizeObserverSize
): boolean {
  switch (condition.type) {
    case ContainerConditionType.ContainerConditionConjunction:
      return (
        isQueryFullfilled(condition.left, borderBox) &&
        isQueryFullfilled(condition.right, borderBox)
      );
    case ContainerConditionType.ContainerConditionDisjunction:
      return (
        isQueryFullfilled(condition.left, borderBox) ||
        isQueryFullfilled(condition.right, borderBox)
      );
    case ContainerConditionType.ContainerConditionNegation:
      return !isQueryFullfilled(condition.right, borderBox);
    case ContainerConditionType.SizeQuery:
      return isSizeQueryFulfilled(condition, borderBox);
    default:
      throw Error('wtf?');
  }
}

export function parseContainerQuery(
  sheetSrc: string,
  srcUrl?: string
): ParseResult {
  const p: AdhocParser = {
    sheetSrc,
    index: 0,
    name: srcUrl,
  };

  const startIndex = p.index;
  // assertString(p, "@container");
  eatWhitespace(p);
  let name: string = '';
  if (peek(p) !== '(' && !lookAhead('size', p) && !lookAhead('style', p)) {
    name = parseIdentifier(p);
    eatWhitespace(p);
  }
  const condition = parseContainerCondition(p);
  eatWhitespace(p);
  const endIndex = p.index;
  eatWhitespace(p);
  return {
    query: {
      condition,
      name,
    },
    startIndex,
    endIndex,
  };
}

function parseContainerCondition(p: AdhocParser): ContainerCondition {
  let left = parseNegatedContainerCondition(p);

  while (true) {
    if (lookAhead('and', p)) {
      assertString(p, 'and');
      eatWhitespace(p);
      const right = parseNegatedContainerCondition(p);
      eatWhitespace(p);
      left = {
        type: ContainerConditionType.ContainerConditionConjunction,
        left,
        right,
      };
    } else if (lookAhead('or', p)) {
      assertString(p, 'or');
      eatWhitespace(p);
      const right = parseNegatedContainerCondition(p);
      eatWhitespace(p);
      left = {
        type: ContainerConditionType.ContainerConditionDisjunction,
        left,
        right,
      };
    } else {
      break;
    }
  }
  return left;
}

function parseNegatedContainerCondition(p: AdhocParser): ContainerCondition {
  if (lookAhead('not', p)) {
    assertString(p, 'not');
    eatWhitespace(p);
    return {
      type: ContainerConditionType.ContainerConditionNegation,
      right: parseSizeOrStyleQuery(p),
    };
  }
  return parseSizeOrStyleQuery(p);
}

function parseSizeOrStyleQuery(p: AdhocParser): ContainerCondition {
  eatWhitespace(p);
  if (lookAhead('(', p)) return parseSizeQuery(p);
  else if (lookAhead('size', p)) {
    assertString(p, 'size');
    eatWhitespace(p);
    return parseSizeQuery(p);
  } else if (lookAhead('style', p)) {
    throw Error(`Style query not implement yet`);
  } else {
    throw Error(`Unknown container query type`);
  }
}

function parseSizeQuery(p: AdhocParser): ContainerCondition {
  assertString(p, '(');
  if (lookAhead('(', p)) {
    const cond = parseContainerCondition(p);
    assertString(p, ')');
    return cond;
  }
  eatWhitespace(p);

  const feature = parseIdentifier(p).toLowerCase();
  eatWhitespace(p);
  const comparator = parseComparator(p);
  eatWhitespace(p);
  const threshold = parseThreshold(p);
  eatWhitespace(p);
  assertString(p, ')');
  eatWhitespace(p);
  return {
    type: ContainerConditionType.SizeQuery,
    feature,
    comparator,
    threshold,
  };
}

function parseComparator(p: AdhocParser): Comparator {
  if (lookAhead('>=', p)) {
    assertString(p, '>=');
    return Comparator.GREATER_OR_EQUAL;
  }
  if (lookAhead('>', p)) {
    assertString(p, '>');
    return Comparator.GREATER_THAN;
  }
  if (lookAhead('<=', p)) {
    assertString(p, '<=');
    return Comparator.LESS_OR_EQUAL;
  }
  if (lookAhead('<', p)) {
    assertString(p, '<');
    return Comparator.LESS_THAN;
  }
  throw Error(`Unknown comparator`);
}

function parseError(p: AdhocParser, msg: string): Error {
  return Error(`${msg}`);
}

function assertString(p: AdhocParser, s: string) {
  if (p.sheetSrc.substr(p.index, s.length) != s) {
    throw parseError(p, `Did not find expected sequence ${s}`);
  }
  p.index += s.length;
}

const whitespaceMatcher = /\s*/g;
function eatWhitespace(p: AdhocParser) {
  // Start matching at the current position in the sheet src
  whitespaceMatcher.lastIndex = p.index;
  const match = whitespaceMatcher.exec(p.sheetSrc);
  if (match) {
    p.index += match[0].length;
  }
}

function advance(p: AdhocParser) {
  p.index++;
  if (p.index > p.sheetSrc.length) {
    throw parseError(p, 'Advanced beyond the end');
  }
}

function eatUntil(s: string, p: AdhocParser): string {
  const startIndex = p.index;
  while (!lookAhead(s, p)) {
    advance(p);
  }
  return p.sheetSrc.slice(startIndex, p.index);
}

function lookAhead(s: string, p: AdhocParser): boolean {
  return p.sheetSrc.substr(p.index, s.length) == s;
}

function peek(p: AdhocParser): string {
  return p.sheetSrc[p.index];
}

const identMatcher = /[\w\\\@_-]+/g;
function parseIdentifier(p: AdhocParser): string {
  identMatcher.lastIndex = p.index;
  const match = identMatcher.exec(p.sheetSrc);
  if (!match) {
    throw parseError(p, 'Expected an identifier');
  }
  p.index += match[0].length;
  return match[0];
}

function parseMeasurementName(p: AdhocParser): string {
  return parseIdentifier(p).toLowerCase();
}

const numberMatcher = /[0-9.]*/g;
function parseThreshold(p: AdhocParser): number {
  numberMatcher.lastIndex = p.index;
  const match = numberMatcher.exec(p.sheetSrc);
  if (!match) {
    throw parseError(p, 'Expected a number');
  }
  p.index += match[0].length;
  // TODO: Support other units?
  assertString(p, 'px');
  const value = parseFloat(match[0]);
  if (Number.isNaN(value)) {
    throw parseError(p, `${match[0]} is not a valid number`);
  }
  return value;
}
