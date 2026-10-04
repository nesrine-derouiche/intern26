import 'package:dio/dio.dart';

import '../core/constants/api_constants.dart';
import '../core/network/api_exception.dart';
import '../models/stagiaire_calendar_event.dart';

class StagiaireCalendarService {
  StagiaireCalendarService(this._dio);

  final Dio _dio;

  Future<List<StagiaireCalendarEvent>> getCalendarEvents() async {
    try {
      final response = await _dio.get<List<dynamic>>(
        ApiConstants.stagiaireCalendar,
      );
      final data = response.data ?? [];
      return data
          .map((e) => StagiaireCalendarEvent.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }
}
