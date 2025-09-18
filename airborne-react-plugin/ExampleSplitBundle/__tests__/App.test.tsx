/**
 * @format
 */

import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import React from 'react';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
