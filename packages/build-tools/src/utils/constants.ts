export const IOS_CACHE_KEY_PREFIX = 'ios-ccache-';
export const ANDROID_CACHE_KEY_PREFIX = 'android-ccache-';
export const DARWIN_CACHE_PATH = 'Library/Caches/ccache';
export const LINUX_CACHE_PATH = '.cache/ccache';

export const PATH_BY_PLATFORM: Record<string, string> = {
  darwin: DARWIN_CACHE_PATH,
  linux: LINUX_CACHE_PATH,
};
