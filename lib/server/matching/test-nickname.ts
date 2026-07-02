import { createExtendedMatcherChain } from './custom-matcher-example';

const entities = ['Michael Smith', 'Mikhail Petrov', 'John Doe'];
const chain = createExtendedMatcherChain();

console.log('Test: "mike" should match both Michael and Mikhail');
const result1 = chain.match('mike smith', entities);
console.log('Result 1:', result1);

const result2 = chain.match('mike petrov', entities);
console.log('Result 2:', result2);

console.log('\n✅ Nickname map fixed!');
