// STUB: replaced by the frontend work package.
import ImageCompressor from './ImageCompressor';
export default function SignatureTool(props: { defaultMaxKb?: number; defaultWidthPx?: number; defaultHeightPx?: number }) {
  return <ImageCompressor defaultTargetKb={props.defaultMaxKb ?? 20} />;
}
