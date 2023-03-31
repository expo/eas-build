import spawn from '@expo/turtle-spawn';

async function getChildrenPidsAsync(parentPids: number[]): Promise<number[]> {
  const result = await spawn('pgrep', ['-P', parentPids.join(',')], {
    stdio: 'pipe',
  });
  return result.stdout
    .toString()
    .split('\n')
    .map((i) => Number(i.trim()))
    .filter((i) => i);
}

export async function getAllChildrenRecursiveAsync(ppid: number): Promise<number[]> {
  const children: number[] = [ppid];
  let shouldRetry = true;
  while (shouldRetry) {
    const pids = await getChildrenPidsAsync(children);
    shouldRetry = false;
    for (const pid of pids) {
      if (!children.includes(pid)) {
        shouldRetry = true;
        children.push(pid);
      }
    }
  }
  return children;
}
