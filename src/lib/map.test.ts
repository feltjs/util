import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {sort_map} from './map.js';

test('basic behavior', () => {
	assert.equal(
		Array.from(
			sort_map(
				new Map([
					['A', 1],
					['B', 1],
					['C', 1],
					['d', 1],
					['a', 1],
					['c', 1],
					['b', 1],
				]),
			).keys(),
		),
		Array.from(
			new Map([
				['a', 1],
				['A', 1],
				['b', 1],
				['B', 1],
				['c', 1],
				['C', 1],
				['d', 1],
			]).keys(),
		),
	);
});

test('custom comparator', () => {
	assert.equal(
		sort_map(
			new Map([
				['d', 1],
				['a', 1],
				['c', 1],
				['b', 1],
			]),
			(a, b) => (a[0] > b[0] ? -1 : 1),
		),
		new Map([
			['d', 1],
			['c', 1],
			['b', 1],
			['a', 1],
		]),
	);
});

test.run();
