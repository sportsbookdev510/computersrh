// The accepted 1280x720 overview is the common coordinate frame for the island,
// distant geometry and procedural sky. All layers share one optical zoom/pan.
export const WORLD_OVERVIEW=Object.freeze({h:.5,v:11.5,height:40,aspect:16/9});
export const HORIZON_HEIGHT=23;

export function worldView(pose,aspect){
  const ref=WORLD_OVERVIEW,ratio=HORIZON_HEIGHT/ref.height;
  return {
    horizon:{h:(pose.h-ref.h)*ratio,v:(pose.v-ref.v)*ratio,height:pose.height*ratio},
    scale:{x:ref.height*ref.aspect/(pose.height*aspect),y:ref.height/pose.height},
    offset:{x:(pose.h-ref.h)/(ref.height*ref.aspect),y:(pose.v-ref.v)/ref.height},
  };
}

export function skyToScreen(point,view){
  return {x:(point.x-.5-view.offset.x)*view.scale.x+.5,
          y:(point.y-.5-view.offset.y)*view.scale.y+.5};
}
