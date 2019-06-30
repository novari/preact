import { Fragment } from 'preact';
import { assign } from '../../../../src/util';
import { Renderer } from './renderer';
import { catchErrors } from '../util';

/**
 * Create an adapter instance for the legacy devtools
 * @param {import('../../internal').RendererConfigBase} config
 * @param {import('../../internal').LegacyDevtoolsHook} hook
 * @param {number} rendererId
 */
export function connectLegacyDevtools(config, hook, rendererId) {
	let adapter = new Renderer(hook);

	let renderer = assign(assign({}, config), {
		// We don't need this, but the devtools `attachRenderer` function relys
		// it being there.
		findHostInstanceByFiber(vnode) {
			return vnode._dom;
		},
		// We don't need this, but the devtools `attachRenderer` function relys
		// it being there.
		findFiberByHostInstance(instance) {
			return adapter.inst2vnode.get(instance) || null;
		}
	});

	hook._renderers[rendererId] = renderer;
	let helpers = hook.helpers[rendererId];

	return {
		connect() {
			// We can't bring our own `attachRenderer` function therefore we simply
			// prevent the devtools from overwriting our custom renderer by creating
			// a noop setter.
			Object.defineProperty(hook.helpers, rendererId, {
				get: () => renderer,
				set: () => {
					if (!adapter.connected) {
						helpers.markConnected();
					}
				}
			});

			// Tell the devtools that we are ready to start
			hook.emit('renderer-attached', {
				id: rendererId,
				renderer,
				helpers
			});
		},
		onCommitRoot: catchErrors(root => {
			// Empty root
			if (root.type===Fragment && root._children.length==0) return;

			let roots = hook.getFiberRoots('' + rendererId);
			root = helpers.handleCommitFiberRoot(root);
			if (!roots.has(root)) roots.add(root);
		})
	};
}