# Deeplink extension — iOS post-build hook.
#
# Mirrors Post-notification.cmake exactly.  RES_DIR is the Cocos native project
# resource directory set by the Cocos build pipeline before this file is included.

if(EXISTS ${RES_DIR}/proj/deeplink)
    include(${RES_DIR}/proj/deeplink/deeplink.cmake)
endif()
