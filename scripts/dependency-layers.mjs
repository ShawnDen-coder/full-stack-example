/** L0 is external. Internal modules must stay in the same or adjacent lower layer. */
export function checkLayerDependency(source, target, layers) {
	const from = layers[source];
	const to = layers[target];
	if (!Number.isInteger(from) || from < 1)
		return `${source}: missing or invalid internal layer`;
	if (!Number.isInteger(to) || to < 1)
		return `${target}: missing or invalid internal layer`;
	if (to > from)
		return `reverse dependency ${source} (L${from}) -> ${target} (L${to}) is forbidden`;
	if (from - to > 1)
		return `skipped internal layer ${source} (L${from}) -> ${target} (L${to}) is forbidden`;
	return undefined;
}
