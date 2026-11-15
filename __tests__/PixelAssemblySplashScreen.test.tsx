import React from 'react';
import renderer, {act} from 'react-test-renderer';
import PixelAssemblySplashScreen from '../src/components/PixelAssemblySplashScreen';

// Mock react-native-svg for Jest tests if needed
jest.mock('react-native-svg', () => {
  const React = require('react');
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, props, props.children),
    Path: (props: any) => React.createElement(View, props, props.children),
    Defs: (props: any) => React.createElement(View, props, props.children),
    LinearGradient: (props: any) => React.createElement(View, props, props.children),
    Stop: (props: any) => React.createElement(View, props, props.children),
    Text: (props: any) => React.createElement(View, props, props.children),
  };
});

describe('PixelAssemblySplashScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders correctly with default state', () => {
    let tree: any;
    act(() => {
      tree = renderer.create(<PixelAssemblySplashScreen />);
    });
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders OTA progress information accurately', () => {
    let tree: any;
    act(() => {
      tree = renderer.create(
        <PixelAssemblySplashScreen
          progressInfo={{
            status: 'downloading',
            percentage: 45,
            message: 'Downloading update bundle v8.1.3...',
            version: '8.1.3',
          }}
        />,
      );
    });

    const root = tree.root;
    expect(root).toBeTruthy();
    // Check percentage text rendering
    const texts = root.findAllByType(require('react-native').Text);
    const hasDownloadBadge = texts.some((t: any) =>
      t.props.children?.toString().includes('DOWNLOADING'),
    );
    expect(hasDownloadBadge).toBe(true);
  });

  it('unmounts cleanly without throwing error', () => {
    let tree: any;
    act(() => {
      tree = renderer.create(<PixelAssemblySplashScreen />);
    });
    expect(() => {
      act(() => {
        tree.unmount();
      });
    }).not.toThrow();
  });
});
