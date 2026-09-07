# Deeplink extension — iOS CMake build rules.
#
# Mirrors notification.cmake conventions exactly.
# No extra system frameworks needed beyond Foundation and UIKit, both of which
# are already linked by the Cocos engine target.  UIKit is linked explicitly
# here as a defensive measure (required for UIApplicationLaunchOptions* keys
# and UIApplicationDelegate method signatures used in AppDelegate integration).
#
# Pure ObjC — no Swift runtime, no xcframework.
#
# Minimum iOS deployment target: iOS 13.0 (matches the Cocos project floor).

# ---------------------------------------------------------------------------
# 1. Collect ObjC bridge sources
# ---------------------------------------------------------------------------

set(DEEPLINK_PROJ_SOURCES)

list(APPEND DEEPLINK_PROJ_SOURCES
    ${CMAKE_CURRENT_LIST_DIR}/DeeplinkServiceHub.mm
    ${CMAKE_CURRENT_LIST_DIR}/DeeplinkServiceHub.h
)

source_group(TREE ${CMAKE_CURRENT_LIST_DIR} PREFIX "Source Files" FILES ${DEEPLINK_PROJ_SOURCES})

# Enable ARC on every source file.
foreach(file ${DEEPLINK_PROJ_SOURCES})
    set_source_files_properties(${file} PROPERTIES COMPILE_OPTIONS "-fobjc-arc")
endforeach()

# ---------------------------------------------------------------------------
# 2. Build the bridge as a static library
# ---------------------------------------------------------------------------

add_library(deeplink ${DEEPLINK_PROJ_SOURCES})

target_include_directories(deeplink PRIVATE
    ${CMAKE_CURRENT_LIST_DIR}
)

# ---------------------------------------------------------------------------
# 3. Link system frameworks
#
# Foundation — NSURL, NSJSONSerialization, NSDictionary, NSUserActivity.
# UIKit     — UIApplicationLaunchOptionsURLKey, UIApplicationLaunchOptionsUserActivityDictionaryKey.
# ---------------------------------------------------------------------------

target_link_libraries(deeplink
    "-framework Foundation"
    "-framework UIKit"
)

# ---------------------------------------------------------------------------
# 4. Link engine and wire deeplink into the final executable
# ---------------------------------------------------------------------------

target_link_libraries(deeplink ${ENGINE_NAME})
target_include_directories(${EXECUTABLE_NAME} PUBLIC ${CMAKE_CURRENT_LIST_DIR})
target_link_libraries(${EXECUTABLE_NAME} deeplink)

# -ObjC ensures +load and constructor functions inside the static lib run even
# if no symbol is directly referenced by the executable.
target_link_options(${EXECUTABLE_NAME} PRIVATE -ObjC)
