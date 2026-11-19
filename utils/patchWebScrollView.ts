import { Platform, ScrollView } from 'react-native';

type ScrollViewPrototype = {
  scrollResponderHandleResponderReject?: () => void;
};

type ForwardRefScrollView = {
  prototype?: ScrollViewPrototype;
  render?: (
    props: Record<string, unknown>,
    ref: unknown,
  ) => { type?: { prototype?: ScrollViewPrototype } } | null;
};

let patched = false;

/**
 * Silencia o aviso legado `ScrollView doesn't take rejection well - scrolls anyway`
 * no react-native-web (já removido no react-native nativo), que dispara quando um
 * ScrollView aninhado recusa ceder o responder durante rolagem por toque.
 */
export function patchWebScrollViewRejectionWarning(): void {
  if (patched || Platform.OS !== 'web') return;
  patched = true;

  try {
    const target = ScrollView as unknown as ForwardRefScrollView;
    const directProto = target.prototype;
    const innerProto =
      typeof target.render === 'function' ? target.render({}, null)?.type?.prototype : undefined;
    const proto = directProto?.scrollResponderHandleResponderReject ? directProto : innerProto;

    if (proto && typeof proto.scrollResponderHandleResponderReject === 'function') {
      proto.scrollResponderHandleResponderReject = () => {};
    }
  } catch {
    // Ignora caso a implementação interna do ScrollView mude em versões futuras.
  }
}
