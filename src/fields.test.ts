import { expect, it } from 'vitest';
import { fieldPlaceholder } from './components/Modal';
it('uses task-specific examples without replacing provided input values', () => {
  expect(fieldPlaceholder('Add remote', { name: 'url', label: 'Git URL' })).toBe(
    'https://github.com/owner/repository.git',
  );
  expect(fieldPlaceholder('Create tag', { name: 'name', label: 'Tag name' })).toBe('v1.0.0');
  const field = { name: 'name', label: 'Name', value: 'upstream' };
  expect(fieldPlaceholder('Add remote', field)).toBe('origin');
  expect(field.value).toBe('upstream');
});
